import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NutritionService } from '../nutrition/nutrition.service';
import { RagService } from '../rag/rag.service';
import { NutritionToolsService } from '../nutrition-tools/nutrition-tools.service';
import { OpenAiClientService } from '../ai/openai-client.service';
import { GenerateMealPlanDto } from './dto/generate-meal-plan.dto';
import { MacroNutrition, scaleMacros } from '../shared/units';

type GenerationStep = {
  step: number;
  name: string;
  prompt: string;
  response: unknown;
};

type MealSlot = {
  dayIndex: number;
  mealType: string;
  scheduledAt: string;
  title: string;
  recipeId?: string;
};

@Injectable()
export class MealPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nutrition: NutritionService,
    private readonly rag: RagService,
    private readonly nutritionTools: NutritionToolsService,
    private readonly openai: OpenAiClientService,
  ) {}

  async list(userId: string) {
    return this.prisma.mealPlan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 3,
        },
      },
    });
  }

  async getPlan(mealPlanId: string, userId: string) {
    const plan = await this.prisma.mealPlan.findFirst({
      where: { id: mealPlanId, userId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            meals: {
              orderBy: [{ dayIndex: 'asc' }, { sortOrder: 'asc' }],
              include: {
                recipe: {
                  select: {
                    id: true,
                    title: true,
                    cuisine: true,
                    timeMinutes: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!plan) throw new NotFoundException('Meal plan not found');
    return plan;
  }

  async generate(userId: string, dto: GenerateMealPlanDto) {
    const combined = await this.nutrition.getCombinedProfile(userId);
    const health = combined.healthProfile;
    const nutritionProfile = combined.nutritionProfile;
    const calorieTarget =
      nutritionProfile?.calorieTarget ??
      combined.suggestedTargets?.calories ??
      2000;
    const macroTargets = (nutritionProfile?.macroTargets as {
      protein: number;
      carbs: number;
      fats: number;
    } | null) ??
      combined.suggestedTargets?.macros ?? {
        protein: 100,
        carbs: 200,
        fats: 60,
      };

    const prefs = {
      dietary_restrictions: Array.isArray(health?.dietaryRestrictions)
        ? health.dietaryRestrictions
        : [],
      dietary_preferences: Array.isArray(health?.dietaryPreferences)
        ? health.dietaryPreferences
        : [],
      cuisine_preferences: Array.isArray(nutritionProfile?.cuisinePreferences)
        ? nutritionProfile.cuisinePreferences
        : [],
      disliked_ingredients: Array.isArray(nutritionProfile?.dislikedIngredients)
        ? nutritionProfile.dislikedIngredients
        : [],
      calorie_target: calorieTarget,
      macronutrient_targets: macroTargets,
      meals_per_day: nutritionProfile?.mealsPerDay ?? 3,
      snacks_per_day: nutritionProfile?.snacksPerDay ?? 0,
      preferred_meal_times: nutritionProfile?.preferredMealTimes ?? {},
      timezone: nutritionProfile?.timezone ?? 'UTC',
    };

    const days = dto.duration === 'weekly' ? 7 : 1;
    const steps: GenerationStep[] = [];

    let strategy: {
      strategy_summary: string;
      daily_calories: number;
      macro_split: { protein: number; carbs: number; fats: number };
      meal_timing_notes: string;
    };

    try {
      strategy = await this.runStep1(userId, prefs, steps);
    } catch {
      strategy = {
        strategy_summary: 'Balanced plan based on your profile and targets.',
        daily_calories: calorieTarget,
        macro_split: macroTargets,
        meal_timing_notes: 'Standard breakfast, lunch, dinner spacing.',
      };
      steps.push({
        step: 1,
        name: 'fallback_strategy',
        prompt: 'local_fallback',
        response: strategy,
      });
    }

    let structure: { meals: MealSlot[] };
    try {
      structure = await this.runStep2(
        strategy,
        prefs,
        days,
        dto.startDate,
        steps,
      );
    } catch {
      structure = this.fallbackStructure(
        prefs,
        days,
        dto.startDate,
        nutritionProfile?.timezone ?? 'UTC',
      );
      steps.push({
        step: 2,
        name: 'fallback_structure',
        prompt: 'local_fallback',
        response: structure,
      });
    }

    structure = this.enforceStructureSlots(
      structure,
      prefs,
      days,
      dto.startDate,
      nutritionProfile?.timezone ?? 'UTC',
    );

    const mealsWithNutrition = await this.runStep3AssignRecipes(
      userId,
      structure.meals,
      prefs,
      steps,
    );
    this.balanceDayNutrition(mealsWithNutrition, prefs);

    const mealPlan = await this.prisma.mealPlan.create({
      data: {
        userId,
        duration: dto.duration,
        startDate: dto.startDate,
      },
    });

    const prevVersions = await this.prisma.mealPlanVersion.count({
      where: { mealPlanId: mealPlan.id },
    });
    await this.prisma.mealPlanVersion.updateMany({
      where: { mealPlanId: mealPlan.id },
      data: { isActive: false },
    });

    const version = await this.prisma.mealPlanVersion.create({
      data: {
        mealPlanId: mealPlan.id,
        versionLabel: dto.version ?? `1.${prevVersions}`,
        versionNumber: prevVersions + 1,
        isActive: true,
        generationSteps: steps as unknown as Prisma.InputJsonValue,
        preferencesSnapshot: prefs as unknown as Prisma.InputJsonValue,
        meals: {
          create: mealsWithNutrition.map((m, idx) => ({
            dayIndex: m.dayIndex,
            mealType: m.mealType,
            scheduledAt: new Date(m.scheduledAt),
            title: m.title,
            recipeId: m.recipeId,
            nutrition: m.nutrition as unknown as Prisma.InputJsonValue,
            alternatives: m.alternatives as unknown as Prisma.InputJsonValue,
            sortOrder: idx,
          })),
        },
      },
      include: { meals: true },
    });

    await this.syncNutritionLogs(userId, version.meals, dto.startDate, days);

    return { mealPlan, version, generationSteps: steps };
  }

  async swapMeals(
    versionId: string,
    userId: string,
    body: { mealIdA: string; mealIdB: string },
  ) {
    await this.assertVersionOwner(versionId, userId);
    const [a, b] = await Promise.all([
      this.prisma.plannedMeal.findFirst({
        where: { id: body.mealIdA, versionId },
      }),
      this.prisma.plannedMeal.findFirst({
        where: { id: body.mealIdB, versionId },
      }),
    ]);
    if (!a || !b) throw new NotFoundException('Meal not found');

    await this.prisma.$transaction([
      this.prisma.plannedMeal.update({
        where: { id: a.id },
        data: {
          dayIndex: b.dayIndex,
          mealType: b.mealType,
          scheduledAt: b.scheduledAt,
          sortOrder: b.sortOrder,
        },
      }),
      this.prisma.plannedMeal.update({
        where: { id: b.id },
        data: {
          dayIndex: a.dayIndex,
          mealType: a.mealType,
          scheduledAt: a.scheduledAt,
          sortOrder: a.sortOrder,
        },
      }),
    ]);
    await this.resyncVersionNutritionLogs(versionId, userId);
    return this.getVersion(versionId, userId);
  }

  async selectAlternative(
    versionId: string,
    userId: string,
    mealId: string,
    alternativeRecipeId: string,
  ) {
    await this.assertVersionOwner(versionId, userId);
    const meal = await this.prisma.plannedMeal.findFirst({
      where: { id: mealId, versionId },
    });
    if (!meal) throw new NotFoundException('Meal not found');

    const alts = Array.isArray(meal.alternatives)
      ? (meal.alternatives as Array<{ recipeId: string; title: string }>)
      : [];
    const picked = alts.find((a) => a.recipeId === alternativeRecipeId);
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: alternativeRecipeId },
    });
    if (!recipe) throw new NotFoundException('Recipe not found');

    const version = await this.prisma.mealPlanVersion.findUnique({
      where: { id: versionId },
    });
    const prefs =
      (version?.preferencesSnapshot as Record<string, unknown> | null) ??
      (await this.buildPrefsFromProfile(userId));
    const scaled =
      await this.nutritionTools.scaleRecipeNutritionViaFunctionCall(
        alternativeRecipeId,
        1,
      );
    const nutrition = this.fitNutritionToTarget(
      scaled.perServing,
      this.slotCalorieBudget(prefs, meal.mealType),
    );
    const newAlts = [
      ...(meal.recipeId
        ? [{ recipeId: meal.recipeId, title: meal.title }]
        : []),
      ...alts.filter((a) => a.recipeId !== alternativeRecipeId),
    ].slice(0, 4);

    const dayMeals = await this.prisma.plannedMeal.findMany({
      where: { versionId, dayIndex: meal.dayIndex },
      orderBy: { sortOrder: 'asc' },
    });
    const balanced = dayMeals.map((m) => ({
      id: m.id,
      nutrition: m.id === mealId ? nutrition : (m.nutrition as MacroNutrition),
    }));
    this.balancePlannedMealRows(balanced, prefs);

    await this.prisma.$transaction(
      balanced.map((row) => {
        const data =
          row.id === mealId
            ? {
                recipeId: alternativeRecipeId,
                title: picked?.title ?? recipe.title,
                nutrition: row.nutrition as unknown as Prisma.InputJsonValue,
                alternatives: newAlts as unknown as Prisma.InputJsonValue,
              }
            : { nutrition: row.nutrition as unknown as Prisma.InputJsonValue };
        return this.prisma.plannedMeal.update({ where: { id: row.id }, data });
      }),
    );
    await this.resyncVersionNutritionLogs(versionId, userId);
    return this.getVersion(versionId, userId);
  }

  async reorderMeals(
    versionId: string,
    userId: string,
    dayIndex: number,
    mealIds: string[],
  ) {
    await this.assertVersionOwner(versionId, userId);
    const meals = await this.prisma.plannedMeal.findMany({
      where: { versionId, dayIndex },
    });
    const idSet = new Set(meals.map((m) => m.id));
    if (mealIds.length !== meals.length) {
      throw new NotFoundException(
        'mealIds must include every meal for this day',
      );
    }
    for (const id of mealIds) {
      if (!idSet.has(id)) {
        throw new NotFoundException(`Meal ${id} not found on day ${dayIndex}`);
      }
    }

    await this.prisma.$transaction(
      mealIds.map((id, sortOrder) =>
        this.prisma.plannedMeal.update({
          where: { id },
          data: { sortOrder },
        }),
      ),
    );
    await this.resyncVersionNutritionLogs(versionId, userId);
    return this.getVersion(versionId, userId);
  }

  async regenerateMeal(versionId: string, userId: string, mealId: string) {
    await this.assertVersionOwner(versionId, userId);
    const meal = await this.prisma.plannedMeal.findFirst({
      where: { id: mealId, versionId },
    });
    if (!meal) throw new NotFoundException('Meal not found');

    const version = await this.prisma.mealPlanVersion.findUnique({
      where: { id: versionId },
    });
    const prefs =
      (version?.preferencesSnapshot as Record<string, unknown> | null) ??
      (await this.buildPrefsFromProfile(userId));

    const slot: MealSlot = {
      dayIndex: meal.dayIndex,
      mealType: meal.mealType,
      scheduledAt: meal.scheduledAt.toISOString(),
      title: meal.title,
    };
    const assigned = await this.assignRecipeToSlot(slot, prefs);

    const dayMeals = await this.prisma.plannedMeal.findMany({
      where: { versionId, dayIndex: meal.dayIndex },
      orderBy: { sortOrder: 'asc' },
    });
    const balanced = dayMeals.map((m) => ({
      id: m.id,
      nutrition:
        m.id === mealId ? assigned.nutrition : (m.nutrition as MacroNutrition),
    }));
    this.balancePlannedMealRows(balanced, prefs);

    await this.prisma.$transaction(
      balanced.map((row) => {
        const data =
          row.id === mealId
            ? {
                title: assigned.title,
                recipeId: assigned.recipeId,
                nutrition: row.nutrition as unknown as Prisma.InputJsonValue,
                alternatives:
                  assigned.alternatives as unknown as Prisma.InputJsonValue,
                eatenAt: null,
              }
            : { nutrition: row.nutrition as unknown as Prisma.InputJsonValue };
        return this.prisma.plannedMeal.update({ where: { id: row.id }, data });
      }),
    );
    await this.resyncVersionNutritionLogs(versionId, userId);
    return this.getVersion(versionId, userId);
  }

  async logMealEaten(versionId: string, userId: string, mealId: string) {
    await this.assertVersionOwner(versionId, userId);
    const meal = await this.prisma.plannedMeal.findFirst({
      where: { id: mealId, versionId },
    });
    if (!meal) throw new NotFoundException('Meal not found');
    await this.prisma.plannedMeal.update({
      where: { id: mealId },
      data: { eatenAt: new Date() },
    });
    return this.getVersion(versionId, userId);
  }

  async unlogMealEaten(versionId: string, userId: string, mealId: string) {
    await this.assertVersionOwner(versionId, userId);
    const meal = await this.prisma.plannedMeal.findFirst({
      where: { id: mealId, versionId },
    });
    if (!meal) throw new NotFoundException('Meal not found');
    await this.prisma.plannedMeal.update({
      where: { id: mealId },
      data: { eatenAt: null },
    });
    return this.getVersion(versionId, userId);
  }

  async logAllMealsForDay(versionId: string, userId: string, dayIndex: number) {
    await this.assertVersionOwner(versionId, userId);
    const now = new Date();
    await this.prisma.plannedMeal.updateMany({
      where: { versionId, dayIndex, eatenAt: null },
      data: { eatenAt: now },
    });
    return this.getVersion(versionId, userId);
  }

  async unlogAllMealsForDay(
    versionId: string,
    userId: string,
    dayIndex: number,
  ) {
    await this.assertVersionOwner(versionId, userId);
    await this.prisma.plannedMeal.updateMany({
      where: { versionId, dayIndex },
      data: { eatenAt: null },
    });
    return this.getVersion(versionId, userId);
  }

  async updateMealSlot(
    versionId: string,
    userId: string,
    mealId: string,
    body: { mealType?: string; dayIndex?: number; scheduledAt?: string },
  ) {
    await this.assertVersionOwner(versionId, userId);
    const meal = await this.prisma.plannedMeal.findFirst({
      where: { id: mealId, versionId },
    });
    if (!meal) throw new NotFoundException('Meal not found');

    const data: Prisma.PlannedMealUpdateInput = {};
    if (body.mealType) data.mealType = body.mealType;
    if (body.dayIndex != null) data.dayIndex = body.dayIndex;
    if (body.scheduledAt) data.scheduledAt = new Date(body.scheduledAt);

    await this.prisma.plannedMeal.update({ where: { id: mealId }, data });
    await this.resyncVersionNutritionLogs(versionId, userId);
    return this.getVersion(versionId, userId);
  }

  async addManualMeal(
    versionId: string,
    userId: string,
    body: {
      dayIndex: number;
      mealType: string;
      scheduledAt: string;
      title: string;
      recipeId?: string;
      nutrition?: Partial<MacroNutrition>;
    },
  ) {
    await this.assertVersionOwner(versionId, userId);
    const version = await this.prisma.mealPlanVersion.findUnique({
      where: { id: versionId },
    });
    if (!version) {
      throw new NotFoundException('Version not found');
    }
    const prefs =
      (version.preferencesSnapshot as Record<string, unknown> | null) ??
      (await this.buildPrefsFromProfile(userId));
    const dayMeals = await this.prisma.plannedMeal.findMany({
      where: { versionId, dayIndex: body.dayIndex },
      orderBy: { sortOrder: 'asc' },
    });
    const nextSortOrder =
      dayMeals.length > 0
        ? Math.max(...dayMeals.map((meal) => meal.sortOrder)) + 1
        : 0;

    let nutrition = this.normalizeNutrition(body.nutrition);
    if (body.recipeId) {
      const scaled =
        await this.nutritionTools.scaleRecipeNutritionViaFunctionCall(
          body.recipeId,
          1,
        );
      nutrition = scaled.perServing;
    }
    if (nutrition.calories <= 0) {
      const target = this.slotCalorieBudget(prefs, body.mealType);
      nutrition = {
        calories: target,
        protein: Math.round((target * 0.3) / 4),
        carbs: Math.round((target * 0.4) / 4),
        fats: Math.round((target * 0.3) / 9),
      };
    }
    const scheduledAt = new Date(body.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException(
        'scheduledAt must be a valid ISO 8601 timestamp',
      );
    }

    await this.prisma.plannedMeal.create({
      data: {
        versionId,
        dayIndex: body.dayIndex,
        mealType: body.mealType,
        scheduledAt,
        title: body.title,
        recipeId: body.recipeId,
        nutrition: nutrition as unknown as Prisma.InputJsonValue,
        alternatives: [] as unknown as Prisma.InputJsonValue,
        isManual: true,
        sortOrder: nextSortOrder,
      },
    });

    await this.resyncVersionNutritionLogs(versionId, userId);
    return this.getVersion(versionId, userId);
  }

  async restoreVersion(mealPlanId: string, versionId: string, userId: string) {
    const plan = await this.prisma.mealPlan.findFirst({
      where: { id: mealPlanId, userId },
    });
    if (!plan) throw new NotFoundException('Meal plan not found');
    const version = await this.prisma.mealPlanVersion.findFirst({
      where: { id: versionId, mealPlanId },
    });
    if (!version) throw new NotFoundException('Version not found');
    await this.prisma.mealPlanVersion.updateMany({
      where: { mealPlanId },
      data: { isActive: false },
    });
    await this.prisma.mealPlanVersion.update({
      where: { id: versionId },
      data: { isActive: true },
    });
    return this.getPlan(mealPlanId, userId);
  }

  async confirmVersionRecipes(versionId: string, userId: string) {
    await this.assertVersionOwner(versionId, userId);
    const version = await this.prisma.mealPlanVersion.findFirst({
      where: { id: versionId, mealPlan: { userId } },
      include: { meals: true },
    });
    if (!version) throw new NotFoundException('Version not found');
    const prefs =
      (version.preferencesSnapshot as Record<string, unknown> | null) ??
      (await this.buildPrefsFromProfile(userId));
    const mealsToConfirm = version.meals.filter((meal) => !meal.recipeId);
    if (!mealsToConfirm.length) {
      return {
        confirmedCount: 0,
        message: 'All meals already linked to recipes.',
      };
    }

    let confirmedCount = 0;
    for (const meal of mealsToConfirm) {
      const draft = await this.generateRecipeDraftForMeal(
        {
          title: meal.title,
          mealType: meal.mealType,
          nutrition: meal.nutrition as MacroNutrition,
        },
        prefs,
      );
      await this.prisma.$transaction(async (tx) => {
        const normalizedLines = new Map<
          string,
          { ingredientId: string; name: string; quantity: number }
        >();
        for (const line of draft.ingredients) {
          const label = line.name.trim();
          if (!label) continue;
          const existing = await tx.ingredient.findFirst({
            where: { label: { equals: label, mode: 'insensitive' } },
          });
          const ingredient =
            existing ??
            (await tx.ingredient.create({
              data: {
                id: this.newId(),
                label,
                unit: 'gram',
                quantity: 100,
                nutrition: {
                  calories: 0,
                  protein: 0,
                  carbs: 0,
                  fats: 0,
                } as unknown as Prisma.InputJsonValue,
              },
            }));
          const key = ingredient.id;
          const prev = normalizedLines.get(key);
          normalizedLines.set(key, {
            ingredientId: ingredient.id,
            name: label,
            quantity: (prev?.quantity ?? 0) + Math.max(1, line.quantityGrams),
          });
        }
        if (!normalizedLines.size) {
          throw new BadRequestException('Generated recipe has no ingredients');
        }

        const createdRecipe = await tx.recipe.create({
          data: {
            id: this.newId(),
            title: draft.title,
            cuisine: draft.cuisine,
            meal: draft.meal,
            servings: draft.servings,
            summary: draft.summary,
            timeMinutes: draft.timeMinutes,
            difficultyLevel: draft.difficultyLevel,
            dietaryTags: draft.dietaryTags as unknown as Prisma.InputJsonValue,
            source: 'ai_generated_confirmed',
            img: null,
            preparation: draft.preparation as unknown as Prisma.InputJsonValue,
            ingredients: {
              create: [...normalizedLines.values()].map((line) => ({
                ingredientId: line.ingredientId,
                name: line.name,
                quantity: line.quantity,
              })),
            },
          },
        });

        await tx.plannedMeal.update({
          where: { id: meal.id },
          data: {
            recipeId: createdRecipe.id,
            title: draft.title,
          },
        });
      });
      confirmedCount += 1;
    }

    await this.resyncVersionNutritionLogs(versionId, userId);
    return {
      confirmedCount,
      message: `Linked and stored ${confirmedCount} AI-generated recipe${confirmedCount === 1 ? '' : 's'}.`,
    };
  }

  async getVersion(versionId: string, userId: string) {
    const version = await this.prisma.mealPlanVersion.findFirst({
      where: { id: versionId, mealPlan: { userId } },
      include: {
        meals: {
          orderBy: [{ dayIndex: 'asc' }, { sortOrder: 'asc' }],
          include: {
            recipe: {
              select: {
                id: true,
                title: true,
                cuisine: true,
                timeMinutes: true,
              },
            },
          },
        },
        mealPlan: true,
      },
    });
    if (!version) throw new NotFoundException('Version not found');
    return version;
  }

  private async resyncVersionNutritionLogs(versionId: string, userId: string) {
    const version = await this.prisma.mealPlanVersion.findFirst({
      where: { id: versionId, mealPlan: { userId } },
      include: { meals: true, mealPlan: true },
    });
    if (!version) return;
    const days = version.mealPlan.duration === 'weekly' ? 7 : 1;
    await this.syncNutritionLogs(
      userId,
      version.meals,
      version.mealPlan.startDate,
      days,
    );
  }

  private async assertVersionOwner(versionId: string, userId: string) {
    const v = await this.prisma.mealPlanVersion.findFirst({
      where: { id: versionId, mealPlan: { userId } },
    });
    if (!v) throw new NotFoundException('Version not found');
  }

  private async runStep1(
    userId: string,
    prefs: Record<string, unknown>,
    steps: GenerationStep[],
  ) {
    const fewShot = {
      input: {
        dietary_restrictions: ['lactose-intolerance'],
        dietary_preferences: ['high-protein'],
        calorie_target: 2100,
        meals_per_day: 3,
        snacks_per_day: 1,
      },
      output: {
        strategy_summary:
          'Higher-protein day plan with lower lactose load and even meal spacing.',
        daily_calories: 2100,
        macro_split: { protein: 150, carbs: 210, fats: 70 },
        meal_timing_notes:
          'Front-load protein at breakfast/lunch, lighter dinner, one afternoon snack.',
      },
    };
    const prompt = `Analyze this user profile and recommend a meal strategy. Return JSON with strategy_summary, daily_calories, macro_split {protein,carbs,fats}, meal_timing_notes.
Few-shot example:
INPUT: ${JSON.stringify(fewShot.input)}
OUTPUT: ${JSON.stringify(fewShot.output)}
Target profile: ${JSON.stringify(prefs)}`;
    if (!this.openai.apiKey) {
      throw new Error('no api key');
    }
    const response = await this.openai.chatJson<{
      strategy_summary: string;
      daily_calories: number;
      macro_split: { protein: number; carbs: number; fats: number };
      meal_timing_notes: string;
    }>(
      'You are a clinical nutrition planner. Output valid JSON only.',
      prompt,
      { temperature: 0.3, topP: 0.9 },
    );
    steps.push({ step: 1, name: 'initial_assessment', prompt, response });
    return response;
  }

  private async runStep2(
    strategy: unknown,
    prefs: Record<string, unknown>,
    days: number,
    startDate: string,
    steps: GenerationStep[],
  ) {
    const mealExample = {
      meals: [
        {
          dayIndex: 0,
          mealType: 'breakfast',
          scheduledAt: `${startDate}T08:00:00.000Z`,
          title: 'Greek yogurt bowl with oats and berries',
        },
        {
          dayIndex: 0,
          mealType: 'lunch',
          scheduledAt: `${startDate}T12:30:00.000Z`,
          title: 'Chicken quinoa salad',
        },
      ],
    };
    const prompt = `Based on this strategy, create a meal structure for ${days} day(s) starting ${startDate}. Return JSON { meals: [{ dayIndex, mealType, scheduledAt ISO8601, title }] }.
Few-shot output shape example: ${JSON.stringify(mealExample)}
Strategy: ${JSON.stringify(strategy)} Preferences: ${JSON.stringify(prefs)}`;
    if (!this.openai.apiKey) throw new Error('no api key');
    const response = await this.openai.chatJson<{ meals: MealSlot[] }>(
      'You plan meal slots with ISO 8601 scheduledAt timestamps. JSON only.',
      prompt,
      { temperature: 0.4, topP: 0.95 },
    );
    steps.push({ step: 2, name: 'meal_structure', prompt, response });
    return response;
  }

  private async buildPrefsFromProfile(userId: string) {
    const combined = await this.nutrition.getCombinedProfile(userId);
    const health = combined.healthProfile;
    const nutritionProfile = combined.nutritionProfile;
    const calorieTarget =
      nutritionProfile?.calorieTarget ??
      combined.suggestedTargets?.calories ??
      2000;
    return {
      dietary_restrictions: Array.isArray(health?.dietaryRestrictions)
        ? health.dietaryRestrictions
        : [],
      dietary_preferences: Array.isArray(health?.dietaryPreferences)
        ? health.dietaryPreferences
        : [],
      cuisine_preferences: Array.isArray(nutritionProfile?.cuisinePreferences)
        ? nutritionProfile.cuisinePreferences
        : [],
      disliked_ingredients: Array.isArray(nutritionProfile?.dislikedIngredients)
        ? nutritionProfile.dislikedIngredients
        : [],
      calorie_target: calorieTarget,
      meals_per_day: nutritionProfile?.mealsPerDay ?? 3,
      snacks_per_day: nutritionProfile?.snacksPerDay ?? 0,
    };
  }

  private dailyCalorieTarget(prefs: Record<string, unknown>): number {
    const raw = prefs.calorie_target;
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 2000;
  }

  /** Calories per slot so main meals + snacks sum to the daily target. */
  private slotCalorieBudget(
    prefs: Record<string, unknown>,
    mealType: string,
  ): number {
    const daily = this.dailyCalorieTarget(prefs);
    const mealsPerDay = Number(prefs.meals_per_day ?? 3);
    const snacksPerDay = Number(prefs.snacks_per_day ?? 0);
    const slotsPerDay = mealsPerDay + snacksPerDay;
    const t = mealType.toLowerCase();
    if (t === 'snack' && snacksPerDay > 0) {
      return Math.max(80, Math.round((daily * 0.15) / snacksPerDay));
    }
    const mainSlots = Math.max(1, slotsPerDay - snacksPerDay);
    const mainShare = snacksPerDay > 0 ? 0.85 : 1;
    return Math.max(120, Math.round((daily * mainShare) / mainSlots));
  }

  /** Align AI structure with meals_per_day + snacks_per_day so calorie budgets stay correct. */
  private enforceStructureSlots(
    structure: { meals: MealSlot[] },
    prefs: Record<string, unknown>,
    days: number,
    startDate: string,
    timezone: string,
  ): { meals: MealSlot[] } {
    const template = this.fallbackStructure(
      prefs,
      days,
      startDate,
      timezone,
    ).meals;
    const byDay = new Map<number, MealSlot[]>();
    for (const slot of structure.meals) {
      const list = byDay.get(slot.dayIndex) ?? [];
      list.push(slot);
      byDay.set(slot.dayIndex, list);
    }

    const meals: MealSlot[] = [];
    for (let d = 0; d < days; d++) {
      const expected = template.filter((m) => m.dayIndex === d);
      const fromAi = (byDay.get(d) ?? []).slice(0, expected.length);
      for (let i = 0; i < expected.length; i++) {
        const exp = expected[i];
        const act = fromAi[i];
        meals.push({
          dayIndex: d,
          mealType: exp.mealType,
          scheduledAt: act?.scheduledAt ?? exp.scheduledAt,
          title: act?.title ?? exp.title,
        });
      }
    }
    return { meals };
  }

  private balanceDayNutrition(
    meals: Array<{ dayIndex: number; nutrition: MacroNutrition }>,
    prefs: Record<string, unknown>,
  ): void {
    const daily = this.dailyCalorieTarget(prefs);
    const dayIndexes = [...new Set(meals.map((m) => m.dayIndex))];
    for (const dayIndex of dayIndexes) {
      const dayMeals = meals.filter((m) => m.dayIndex === dayIndex);
      this.scaleMealsToDailyTarget(dayMeals, daily);
    }
  }

  private balancePlannedMealRows(
    rows: Array<{ nutrition: MacroNutrition }>,
    prefs: Record<string, unknown>,
  ): void {
    this.scaleMealsToDailyTarget(rows, this.dailyCalorieTarget(prefs));
  }

  private scaleMealsToDailyTarget(
    meals: Array<{ nutrition: MacroNutrition }>,
    dailyTarget: number,
  ): void {
    if (!meals.length) return;
    const total = meals.reduce(
      (sum, m) => sum + (m.nutrition.calories ?? 0),
      0,
    );
    if (total <= 0) return;
    const factor = dailyTarget / total;
    if (Math.abs(factor - 1) < 0.02) return;
    for (const meal of meals) {
      meal.nutrition = scaleMacros(meal.nutrition, factor);
    }
  }

  private fitNutritionToTarget(
    perServing: MacroNutrition,
    targetCalories: number,
  ): MacroNutrition {
    const base = Math.max(perServing.calories, 1);
    const portion = Math.min(2.5, Math.max(0.2, targetCalories / base));
    return scaleMacros(perServing, portion);
  }

  private normalizeNutrition(
    nutrition?: Partial<MacroNutrition>,
  ): MacroNutrition {
    return {
      calories: Math.max(0, Math.round(Number(nutrition?.calories ?? 0))),
      protein: Math.max(0, Number(nutrition?.protein ?? 0)),
      carbs: Math.max(0, Number(nutrition?.carbs ?? 0)),
      fats: Math.max(0, Number(nutrition?.fats ?? 0)),
    };
  }

  private newId() {
    return globalThis.crypto?.randomUUID?.()
      ? globalThis.crypto.randomUUID()
      : `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  private async generateRecipeDraftForMeal(
    meal: { title: string; mealType: string; nutrition: MacroNutrition },
    prefs: Record<string, unknown>,
  ): Promise<{
    title: string;
    cuisine: string;
    meal: string;
    servings: number;
    summary: string;
    timeMinutes: number;
    difficultyLevel: string;
    dietaryTags: string[];
    ingredients: Array<{ name: string; quantityGrams: number }>;
    preparation: string[];
  }> {
    const fallback = {
      title: meal.title,
      cuisine:
        (Array.isArray(prefs.cuisine_preferences) &&
        typeof prefs.cuisine_preferences[0] === 'string'
          ? prefs.cuisine_preferences[0]
          : 'international') ?? 'international',
      meal: meal.mealType,
      servings: 1,
      summary: `AI-generated ${meal.mealType} tailored to your nutrition target.`,
      timeMinutes: 25,
      difficultyLevel: 'easy',
      dietaryTags: Array.isArray(prefs.dietary_preferences)
        ? (prefs.dietary_preferences as string[]).slice(0, 5)
        : [],
      ingredients: [
        { name: 'mixed vegetables', quantityGrams: 180 },
        { name: 'protein source', quantityGrams: 140 },
        { name: 'whole grains', quantityGrams: 120 },
      ],
      preparation: [
        'Prepare and cut all ingredients.',
        'Cook protein and vegetables until done.',
        'Combine with grains and season to taste.',
      ],
    };
    if (!this.openai.apiKey) return fallback;
    try {
      const generated = await this.openai.chatJson<{
        title: string;
        cuisine: string;
        meal: string;
        servings: number;
        summary: string;
        timeMinutes: number;
        difficultyLevel: string;
        dietaryTags: string[];
        ingredients: Array<{ name: string; quantityGrams: number }>;
        preparation: string[];
      }>(
        'You generate complete recipe JSON for a planned meal. Return strict JSON only.',
        `Create a complete recipe for this meal slot.
Meal slot: ${JSON.stringify(meal)}
User preferences: ${JSON.stringify({
          dietary_preferences: prefs.dietary_preferences ?? [],
          dietary_restrictions: prefs.dietary_restrictions ?? [],
          cuisine_preferences: prefs.cuisine_preferences ?? [],
          disliked_ingredients: prefs.disliked_ingredients ?? [],
        })}
Required JSON shape:
{
  "title": "string",
  "cuisine": "string",
  "meal": "string",
  "servings": 1,
  "summary": "string",
  "timeMinutes": 25,
  "difficultyLevel": "easy|medium|hard",
  "dietaryTags": ["string"],
  "ingredients": [{"name":"string","quantityGrams":120}],
  "preparation": ["step 1", "step 2"]
}`,
        { temperature: 0.7, topP: 0.95 },
      );
      const ingredients = Array.isArray(generated.ingredients)
        ? generated.ingredients
            .filter((line) => typeof line?.name === 'string')
            .map((line) => ({
              name: line.name.trim(),
              quantityGrams: Math.max(
                1,
                Math.round(Number(line.quantityGrams ?? 100)),
              ),
            }))
            .filter((line) => line.name.length > 0)
        : [];
      const prep = Array.isArray(generated.preparation)
        ? generated.preparation
            .filter(
              (step): step is string =>
                typeof step === 'string' && step.trim().length > 0,
            )
            .slice(0, 10)
        : [];
      return {
        title: (generated.title || meal.title).trim(),
        cuisine: (generated.cuisine || fallback.cuisine).trim(),
        meal: (generated.meal || meal.mealType).trim().toLowerCase(),
        servings: Math.max(1, Math.round(Number(generated.servings ?? 1))),
        summary:
          typeof generated.summary === 'string' && generated.summary.trim()
            ? generated.summary.trim()
            : fallback.summary,
        timeMinutes: Math.max(
          5,
          Math.round(Number(generated.timeMinutes ?? 25)),
        ),
        difficultyLevel:
          generated.difficultyLevel === 'medium' ||
          generated.difficultyLevel === 'hard'
            ? generated.difficultyLevel
            : 'easy',
        dietaryTags: Array.isArray(generated.dietaryTags)
          ? generated.dietaryTags
              .filter(
                (tag): tag is string =>
                  typeof tag === 'string' && tag.trim().length > 0,
              )
              .slice(0, 8)
          : fallback.dietaryTags,
        ingredients: ingredients.length ? ingredients : fallback.ingredients,
        preparation: prep.length ? prep : fallback.preparation,
      };
    } catch {
      return fallback;
    }
  }

  private async assignRecipeToSlot(
    slot: MealSlot,
    prefs: Record<string, unknown>,
    preferred?: { recipeId?: string; title?: string },
  ): Promise<
    MealSlot & {
      recipeId?: string;
      nutrition: MacroNutrition;
      alternatives: Array<{ recipeId: string; title: string }>;
    }
  > {
    const query = `${slot.mealType} ${preferred?.title ?? slot.title} ${(prefs.cuisine_preferences as string[])?.join(' ') ?? ''}`;
    const targetCalories = this.slotCalorieBudget(prefs, slot.mealType);
    const retrieved = await this.rag.searchRecipes(query, {
      limit: 12,
      dietaryTags: [
        ...(prefs.dietary_preferences as string[]),
        ...(prefs.dietary_restrictions as string[]),
      ],
    });
    const candidates = retrieved.map((item) => ({
      id: item.id,
      title: item.title,
      relevanceScore: item.relevanceScore,
    }));

    let nutrition: MacroNutrition = {
      calories: 0,
      carbs: 0,
      protein: 0,
      fats: 0,
    };
    let recipeId: string | undefined;
    let title = slot.title;

    if (candidates.length) {
      let bestId = preferred?.recipeId ?? candidates[0].id;
      let bestTitle = preferred?.title ?? candidates[0].title;
      let bestNutrition = nutrition;
      let bestScore = Number.POSITIVE_INFINITY;

      for (const candidate of candidates.slice(0, 8)) {
        if (preferred?.recipeId && candidate.id !== preferred.recipeId)
          continue;
        const scaled =
          await this.nutritionTools.scaleRecipeNutritionViaFunctionCall(
            candidate.id,
            1,
          );
        const fitted = this.fitNutritionToTarget(
          scaled.perServing,
          targetCalories,
        );
        const calorieGap = Math.abs(fitted.calories - targetCalories);
        const score = calorieGap - candidate.relevanceScore * 40;
        if (score < bestScore) {
          bestScore = score;
          bestId = candidate.id;
          bestTitle = candidate.title;
          bestNutrition = fitted;
        }
      }

      recipeId = bestId;
      title = bestTitle;
      nutrition = bestNutrition;
    } else {
      // AI-only fallback: keep generated meal title and synthesize balanced macros
      // from slot calorie budget when no grounded recipe candidate is available.
      title = this.generateFallbackMealTitle(slot, prefs);
      const p = Math.round((targetCalories * 0.3) / 4);
      const c = Math.round((targetCalories * 0.4) / 4);
      const f = Math.max(1, Math.round((targetCalories - p * 4 - c * 4) / 9));
      nutrition = {
        calories: targetCalories,
        protein: p,
        carbs: c,
        fats: f,
      };
    }

    return {
      ...slot,
      title,
      recipeId,
      nutrition,
      alternatives: candidates.slice(1, 5).map((r) => ({
        recipeId: r.id,
        title: r.title,
      })),
    };
  }

  private generateFallbackMealTitle(
    slot: MealSlot,
    prefs: Record<string, unknown>,
  ): string {
    const cuisinePrefs = Array.isArray(prefs.cuisine_preferences)
      ? (prefs.cuisine_preferences as string[])
      : [];
    const cuisine =
      cuisinePrefs[Math.floor(Math.random() * cuisinePrefs.length)] ??
      'balanced';
    const mealType = slot.mealType.toLowerCase();
    const stems: Record<string, string[]> = {
      breakfast: ['power bowl', 'oat and fruit bowl', 'savory toast plate'],
      lunch: ['protein salad bowl', 'grain bowl', 'veggie wrap plate'],
      dinner: ['hearty skillet', 'roasted plate', 'warm bowl'],
      snack: ['quick snack plate', 'energy bites', 'fresh snack bowl'],
    };
    const options = stems[mealType] ?? ['meal bowl'];
    const pick = options[Math.floor(Math.random() * options.length)];
    return `${cuisine} ${pick}`.replace(/\s+/g, ' ').trim();
  }

  private async runStep3AssignRecipes(
    _userId: string,
    slots: MealSlot[],
    prefs: Record<string, unknown>,
    steps: GenerationStep[],
  ) {
    /** Weekly plans have many slots; per-slot OpenAI calls exceed proxy timeouts. */
    const fastPath = slots.length > 6;
    const usedByDay = new Map<number, Set<string>>();
    const results: Array<
      MealSlot & {
        recipeId?: string;
        nutrition: MacroNutrition;
        alternatives: Array<{ recipeId: string; title: string }>;
      }
    > = [];

    for (const slot of slots) {
      const query = `${slot.mealType} ${slot.title} ${(prefs.cuisine_preferences as string[])?.join(' ') ?? ''}`;
      const retrieved = await this.rag.searchRecipes(query, {
        limit: 12,
        dietaryTags: [
          ...(prefs.dietary_preferences as string[]),
          ...(prefs.dietary_restrictions as string[]),
        ],
      });
      const augmentedPrompt = this.rag.buildAugmentedPrompt(query, retrieved);
      const used = usedByDay.get(slot.dayIndex) ?? new Set<string>();
      const aiGrounded = fastPath
        ? this.fastGroundedSelection(slot, retrieved, used)
        : await this.generateGroundedSelection(
            slot,
            prefs,
            retrieved,
            augmentedPrompt,
          );
      if (aiGrounded.recipeId) used.add(aiGrounded.recipeId);
      usedByDay.set(slot.dayIndex, used);

      steps.push({
        step: 3,
        name: `recipe_selection_${slot.mealType}_d${slot.dayIndex}`,
        prompt: augmentedPrompt,
        response: {
          retrieved,
          targetCalories: this.slotCalorieBudget(prefs, slot.mealType),
          aiGrounded,
          fastPath,
        },
      });

      results.push(
        await this.assignRecipeToSlot(slot, prefs, {
          recipeId: aiGrounded.recipeId,
          title: aiGrounded.title,
        }),
      );
    }
    return results;
  }

  private pickRetrievedRecipe(
    retrieved: Array<{ id: string; title: string }>,
    usedIds: Set<string>,
  ) {
    if (!retrieved.length) return undefined;
    return retrieved.find((r) => !usedIds.has(r.id)) ?? retrieved[0];
  }

  private fastGroundedSelection(
    slot: MealSlot,
    retrieved: Array<{ id: string; title: string }>,
    usedIds: Set<string>,
  ): {
    recipeId?: string;
    title?: string;
    rationale: string;
    usedFallback: boolean;
  } {
    const pick = this.pickRetrievedRecipe(retrieved, usedIds);
    return {
      recipeId: pick?.id,
      title: pick?.title ?? slot.title,
      rationale:
        'Weekly plan: selected from RAG results with day-level variety (no per-slot LLM call).',
      usedFallback: true,
    };
  }

  private async generateGroundedSelection(
    slot: MealSlot,
    prefs: Record<string, unknown>,
    retrieved: Array<{
      id: string;
      title: string;
      cuisine: string;
      summary: string;
    }>,
    augmentedPrompt: string,
  ): Promise<{
    recipeId?: string;
    title?: string;
    rationale: string;
    usedFallback: boolean;
  }> {
    if (!this.openai.apiKey || !retrieved.length) {
      return {
        recipeId: retrieved[0]?.id,
        title: retrieved[0]?.title ?? slot.title,
        rationale: 'Fallback selection from top retrieved result.',
        usedFallback: true,
      };
    }
    try {
      const response = await this.openai.chatJson<{
        recipeId?: string;
        title?: string;
        rationale: string;
      }>(
        'You are selecting one grounded recipe from retrieved examples. Return JSON only with recipeId, title, rationale. recipeId must be one of retrieved IDs.',
        `${augmentedPrompt}

Meal slot context: ${JSON.stringify(slot)}
User preferences: ${JSON.stringify({
          dietary_restrictions: prefs.dietary_restrictions,
          dietary_preferences: prefs.dietary_preferences,
          cuisine_preferences: prefs.cuisine_preferences,
          disliked_ingredients: prefs.disliked_ingredients,
        })}
Allowed recipe IDs: ${JSON.stringify(retrieved.map((r) => r.id))}`,
        { temperature: 0.2, topP: 0.9 },
      );
      const allowed = new Set(retrieved.map((r) => r.id));
      const recipeId =
        response.recipeId && allowed.has(response.recipeId)
          ? response.recipeId
          : retrieved[0]?.id;
      const fromRetrieved = retrieved.find((r) => r.id === recipeId);
      return {
        recipeId,
        title: fromRetrieved?.title ?? response.title ?? slot.title,
        rationale:
          typeof response.rationale === 'string' && response.rationale.trim()
            ? response.rationale.trim()
            : 'Selected based on retrieval relevance and constraints.',
        usedFallback: false,
      };
    } catch {
      return {
        recipeId: retrieved[0]?.id,
        title: retrieved[0]?.title ?? slot.title,
        rationale: 'Fallback selection from top retrieved result.',
        usedFallback: true,
      };
    }
  }

  private fallbackStructure(
    prefs: Record<string, unknown>,
    days: number,
    startDate: string,
    timezone: string,
  ): { meals: MealSlot[] } {
    const meals: MealSlot[] = [];
    const mealsPerDay = Number(prefs.meals_per_day ?? 3);
    const snacksPerDay = Number(prefs.snacks_per_day ?? 0);
    const mainLabels = ['breakfast', 'lunch', 'dinner'];
    const types: string[] = [];
    for (let i = 0; i < mealsPerDay; i++) {
      types.push(mainLabels[i] ?? 'meal');
    }
    for (let s = 0; s < snacksPerDay; s++) {
      types.push('snack');
    }

    for (let d = 0; d < days; d++) {
      const base = new Date(`${startDate}T08:00:00.000Z`);
      base.setUTCDate(base.getUTCDate() + d);
      // Timezone is currently used as metadata for future local-time scheduling.
      void timezone;
      const hours = [8, 10, 12, 15, 19];
      types.forEach((mealType, i) => {
        const at = new Date(base);
        at.setUTCHours(hours[i] ?? 12, 0, 0, 0);
        meals.push({
          dayIndex: d,
          mealType,
          scheduledAt: at.toISOString(),
          title: `${mealType} — day ${d + 1}`,
        });
      });
    }
    return { meals };
  }

  private async syncNutritionLogs(
    userId: string,
    meals: Array<{ dayIndex: number; nutrition: unknown }>,
    startDate: string,
    days: number,
  ) {
    for (let d = 0; d < days; d++) {
      const dayMeals = meals.filter((m) => m.dayIndex === d);
      let calories = 0;
      let protein = 0;
      let carbs = 0;
      let fats = 0;
      for (const m of dayMeals) {
        const n = m.nutrition as MacroNutrition;
        calories += n.calories ?? 0;
        protein += n.protein ?? 0;
        carbs += n.carbs ?? 0;
        fats += n.fats ?? 0;
      }
      const date = this.addDays(startDate, d);
      await this.prisma.nutritionDayLog.upsert({
        where: {
          userId_date_source: { userId, date, source: 'planned' },
        },
        create: {
          userId,
          date,
          source: 'planned',
          calories: Math.round(calories),
          protein,
          carbs,
          fats,
        },
        update: {
          calories: Math.round(calories),
          protein,
          carbs,
          fats,
        },
      });
    }
  }

  private addDays(isoDate: string, offset: number): string {
    const d = new Date(`${isoDate}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  }
}
