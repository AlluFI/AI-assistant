import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NutritionService } from '../nutrition/nutrition.service';
import { NutritionToolsService } from '../nutrition-tools/nutrition-tools.service';
import { GenerateMealPlanDto } from './dto/generate-meal-plan.dto';
import { EnhancedNutritionService } from '../enhanced-nutrition/enhanced-nutrition.service';
import { isHiddenDemoMealPlanId } from '../shared/demo-meal-plan.util';
import { MacroNutrition } from '../shared/units';
import {
  balanceDayNutrition,
  balancePlannedMealRows,
  dailyCalorieTarget,
  evaluateDayAgainstTargets,
  fitNutritionToTarget,
  newMealPlanId,
  normalizeNutrition,
  slotCalorieBudget,
  sumMealNutrition,
} from './meal-plan-nutrition.util';
import type { GenerationStep, MealSlot } from './meal-plans.types';
import { MealPlanGenerationService } from './meal-plan-generation.service';
import {
  planCoversDate,
  planEndDate,
  utcTodayIso,
} from '../shared/meal-plan-date.util';

@Injectable()
export class MealPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nutrition: NutritionService,
    private readonly nutritionTools: NutritionToolsService,
    private readonly generation: MealPlanGenerationService,
    private readonly enhancedNutrition: EnhancedNutritionService,
  ) {}

  async list(userId: string, referenceDate?: string) {
    const today = referenceDate?.slice(0, 10) ?? utcTodayIso();
    const rows = await this.prisma.mealPlan.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 3,
        },
      },
    });
    return rows
      .filter((plan) => !isHiddenDemoMealPlanId(plan.id))
      .map((plan) => this.mapPlanListItem(plan, today));
  }

  async listHistory(userId: string, q?: string) {
    const today = utcTodayIso();
    const rows = await this.prisma.mealPlan.findMany({
      where: { userId },
      orderBy: { startDate: 'desc' },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });
    const query = q?.trim().toLowerCase() ?? '';
    return rows
      .filter((plan) => !isHiddenDemoMealPlanId(plan.id))
      .filter(
        (plan) => !planCoversDate(plan.startDate, plan.duration, today),
      )
      .filter((plan) => {
        if (!query) return true;
        const end = planEndDate(plan.startDate, plan.duration);
        const label = `${plan.duration} ${plan.startDate} ${end}`.toLowerCase();
        return label.includes(query) || plan.startDate.includes(query);
      })
      .map((plan) => this.mapPlanListItem(plan, today));
  }

  async reapplyPlan(
    mealPlanId: string,
    userId: string,
    startDate: string,
  ) {
    if (isHiddenDemoMealPlanId(mealPlanId)) {
      throw new NotFoundException('Meal plan not found');
    }
    const plan = await this.prisma.mealPlan.findFirst({
      where: { id: mealPlanId, userId },
    });
    if (!plan) throw new NotFoundException('Meal plan not found');

    const latestVersion = await this.prisma.mealPlanVersion.findFirst({
      where: { mealPlanId },
      orderBy: { versionNumber: 'desc' },
      include: { meals: true },
    });
    if (!latestVersion) throw new NotFoundException('No plan version found');

    await this.prisma.mealPlan.update({
      where: { id: mealPlanId },
      data: { startDate, updatedAt: new Date() },
    });

    await this.prisma.mealPlanVersion.updateMany({
      where: { mealPlan: { userId } },
      data: { isActive: false },
    });

    await this.prisma.mealPlanVersion.update({
      where: { id: latestVersion.id },
      data: { isActive: true },
    });

    const days = plan.duration === 'weekly' ? 7 : 1;
    await this.syncNutritionLogs(userId, latestVersion.meals, startDate, days);
    await this.resyncVersionNutritionLogs(latestVersion.id, userId);

    return this.getPlan(mealPlanId, userId);
  }

  private mapPlanListItem(
    plan: {
      id: string;
      duration: string;
      startDate: string;
      updatedAt: Date;
      versions: Array<{
        id: string;
        versionLabel: string;
        versionNumber: number;
        isActive: boolean;
      }>;
    },
    referenceDate: string,
  ) {
    const endDate = planEndDate(plan.startDate, plan.duration);
    const coversToday = planCoversDate(
      plan.startDate,
      plan.duration,
      referenceDate,
    );
    return {
      id: plan.id,
      duration: plan.duration,
      startDate: plan.startDate,
      endDate,
      coversToday,
      isExpired: !coversToday,
      updatedAt: plan.updatedAt.toISOString(),
      versions: plan.versions.map((v) => ({
        id: v.id,
        versionLabel: v.versionLabel,
        versionNumber: v.versionNumber,
        isActive: v.isActive,
      })),
    };
  }

  async getPlan(mealPlanId: string, userId: string) {
    if (isHiddenDemoMealPlanId(mealPlanId)) {
      throw new NotFoundException('Meal plan not found');
    }
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

    const active = plan.versions.find((v) => v.isActive) ?? plan.versions[0];
    const activeAnalytics = active
      ? await this.enhancedNutrition.refreshVersionEnhanced(active.id)
      : null;

    return {
      ...plan,
      versions: plan.versions.map((version) => ({
        ...version,
        enhanced_analytics:
          version.id === active?.id && activeAnalytics
            ? activeAnalytics
            : this.enhancedNutrition.versionEnhancedAnalytics(version),
      })),
    };
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
      strategy = await this.generation.runStep1(userId, prefs, steps);
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
      structure = await this.generation.runStep2(
        strategy,
        prefs,
        days,
        dto.startDate,
        steps,
      );
    } catch {
      structure = this.generation.fallbackStructure(
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

    structure = this.generation.enforceStructureSlots(
      structure,
      prefs,
      days,
      dto.startDate,
      nutritionProfile?.timezone ?? 'UTC',
    );

    const mealsWithNutrition = await this.generation.runStep3AssignRecipes(
      userId,
      structure.meals,
      prefs,
      steps,
    );
    balanceDayNutrition(mealsWithNutrition, prefs);

    const mealPlan = await this.prisma.mealPlan.create({
      data: {
        userId,
        duration: dto.duration,
        startDate: dto.startDate,
      },
    });

    await this.prisma.mealPlanVersion.updateMany({
      where: { mealPlan: { userId } },
      data: { isActive: false },
    });

    const prevVersions = await this.prisma.mealPlanVersion.count({
      where: { mealPlanId: mealPlan.id },
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
    const enhanced_analytics =
      await this.enhancedNutrition.refreshVersionEnhanced(version.id);

    return { mealPlan, version, generationSteps: steps, enhanced_analytics };
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
      (await this.generation.buildPrefsFromProfile(userId));
    const scaled =
      await this.nutritionTools.scaleRecipeNutritionViaFunctionCall(
        alternativeRecipeId,
        1,
      );
    const nutrition = fitNutritionToTarget(
      scaled.perServing,
      slotCalorieBudget(prefs, meal.mealType),
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
    balancePlannedMealRows(balanced, prefs);

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

  async replaceMealWithRecipe(
    versionId: string,
    userId: string,
    mealId: string,
    body: {
      recipeId: string;
      servings?: number;
      replanDay?: boolean;
      preview?: boolean;
    },
  ) {
    await this.assertVersionOwner(versionId, userId);
    const built = await this.buildReplaceMealPreview(
      versionId,
      userId,
      mealId,
      body.recipeId,
      body.servings ?? 1,
    );

    if (body.preview) {
      return {
        mealId: built.meal.id,
        mealType: built.meal.mealType,
        dayIndex: built.meal.dayIndex,
        recipeTitle: built.recipe.title,
        newMealNutrition: built.newNutrition,
        projectedTotals: built.projectedTotals,
        calorieTarget: built.calorieTarget,
        macroTargets: built.macroTargets,
        evaluation: built.evaluation,
        dayMeals: built.dayMeals.map((m) => ({
          id: m.id,
          mealType: m.mealType,
          title: m.title,
          scheduledAt: m.scheduledAt.toISOString(),
        })),
      };
    }

    const { recipe, newNutrition, newAlts, dayMeals, evaluation } = built;
    const mealIdToReplace = built.meal.id;

    if (body.replanDay) {
      const rows: Array<{
        id: string;
        title: string;
        recipeId: string | null;
        nutrition: MacroNutrition;
        alternatives: Array<{ recipeId: string; title: string }>;
      }> = [];

      for (const m of dayMeals) {
        if (m.id === mealIdToReplace) {
          rows.push({
            id: m.id,
            title: recipe.title,
            recipeId: body.recipeId,
            nutrition: newNutrition,
            alternatives: newAlts,
          });
          continue;
        }
        const slot: MealSlot = {
          dayIndex: m.dayIndex,
          mealType: m.mealType,
          scheduledAt: m.scheduledAt.toISOString(),
          title: m.title,
        };
        const assigned = await this.generation.assignRecipeToSlot(
          slot,
          built.prefs,
        );
        rows.push({
          id: m.id,
          title: assigned.title,
          recipeId: assigned.recipeId ?? null,
          nutrition: assigned.nutrition,
          alternatives: assigned.alternatives,
        });
      }

      const balanced = rows.map((row) => ({
        id: row.id,
        nutrition: row.nutrition,
      }));
      balancePlannedMealRows(balanced, built.prefs);

      await this.prisma.$transaction(
        rows.map((row, idx) => {
          const data =
            row.id === mealIdToReplace
              ? {
                  title: row.title,
                  recipeId: row.recipeId,
                  nutrition: balanced[idx].nutrition as unknown as Prisma.InputJsonValue,
                  alternatives: row.alternatives as unknown as Prisma.InputJsonValue,
                  eatenAt: null,
                }
              : {
                  title: row.title,
                  recipeId: row.recipeId,
                  nutrition: balanced[idx].nutrition as unknown as Prisma.InputJsonValue,
                  alternatives: row.alternatives as unknown as Prisma.InputJsonValue,
                };
          return this.prisma.plannedMeal.update({
            where: { id: row.id },
            data,
          });
        }),
      );
    } else {
      await this.prisma.plannedMeal.update({
        where: { id: mealIdToReplace },
        data: {
          recipeId: body.recipeId,
          title: recipe.title,
          nutrition: newNutrition as unknown as Prisma.InputJsonValue,
          alternatives: newAlts as unknown as Prisma.InputJsonValue,
          eatenAt: null,
        },
      });
    }

    await this.resyncVersionNutritionLogs(versionId, userId);
    const version = await this.getVersion(versionId, userId);
    return {
      version,
      replanDay: Boolean(body.replanDay),
      evaluation,
    };
  }

  private async buildReplaceMealPreview(
    versionId: string,
    userId: string,
    mealId: string,
    recipeId: string,
    servingsInput: number,
  ) {
    const meal = await this.prisma.plannedMeal.findFirst({
      where: { id: mealId, versionId },
    });
    if (!meal) throw new NotFoundException('Meal not found');

    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
    });
    if (!recipe) throw new NotFoundException('Recipe not found');

    const version = await this.prisma.mealPlanVersion.findUnique({
      where: { id: versionId },
    });
    const prefs =
      (version?.preferencesSnapshot as Record<string, unknown> | null) ??
      (await this.generation.buildPrefsFromProfile(userId));

    const servings = Math.max(0.25, Math.min(10, servingsInput));
    const scaled =
      await this.nutritionTools.scaleRecipeNutritionViaFunctionCall(
        recipeId,
        servings,
      );
    const newNutrition = normalizeNutrition(scaled.nutrition);

    const alts = Array.isArray(meal.alternatives)
      ? (meal.alternatives as Array<{ recipeId: string; title: string }>)
      : [];
    const newAlts = [
      ...(meal.recipeId
        ? [{ recipeId: meal.recipeId, title: meal.title }]
        : []),
      ...alts.filter((a) => a.recipeId !== recipeId),
    ].slice(0, 4);

    const dayMeals = await this.prisma.plannedMeal.findMany({
      where: { versionId, dayIndex: meal.dayIndex },
      orderBy: { sortOrder: 'asc' },
    });

    const projectedTotals = sumMealNutrition(
      dayMeals.map((m) => ({
        nutrition:
          m.id === mealId
            ? newNutrition
            : normalizeNutrition(m.nutrition as Partial<MacroNutrition>),
      })),
    );

    const combined = await this.nutrition.getCombinedProfile(userId);
    const macroTargets = combined.nutritionProfile?.macroTargets as
      | Partial<MacroNutrition>
      | null
      | undefined;

    const evaluation = evaluateDayAgainstTargets(
      projectedTotals,
      prefs,
      macroTargets,
    );

    return {
      meal,
      recipe,
      prefs,
      newNutrition,
      newAlts,
      dayMeals,
      projectedTotals,
      macroTargets: macroTargets ?? null,
      calorieTarget: dailyCalorieTarget(prefs),
      evaluation,
    };
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
      (await this.generation.buildPrefsFromProfile(userId));

    const slot: MealSlot = {
      dayIndex: meal.dayIndex,
      mealType: meal.mealType,
      scheduledAt: meal.scheduledAt.toISOString(),
      title: meal.title,
    };
    const assigned = await this.generation.assignRecipeToSlot(slot, prefs);

    const dayMeals = await this.prisma.plannedMeal.findMany({
      where: { versionId, dayIndex: meal.dayIndex },
      orderBy: { sortOrder: 'asc' },
    });
    const balanced = dayMeals.map((m) => ({
      id: m.id,
      nutrition:
        m.id === mealId ? assigned.nutrition : (m.nutrition as MacroNutrition),
    }));
    balancePlannedMealRows(balanced, prefs);

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
      (await this.generation.buildPrefsFromProfile(userId));
    const dayMeals = await this.prisma.plannedMeal.findMany({
      where: { versionId, dayIndex: body.dayIndex },
      orderBy: { sortOrder: 'asc' },
    });
    const nextSortOrder =
      dayMeals.length > 0
        ? Math.max(...dayMeals.map((meal) => meal.sortOrder)) + 1
        : 0;

    let nutrition = normalizeNutrition(body.nutrition);
    if (body.recipeId) {
      const scaled =
        await this.nutritionTools.scaleRecipeNutritionViaFunctionCall(
          body.recipeId,
          1,
        );
      nutrition = scaled.perServing;
    }
    if (nutrition.calories <= 0) {
      const target = slotCalorieBudget(prefs, body.mealType);
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
      (await this.generation.buildPrefsFromProfile(userId));
    const mealsToConfirm = version.meals.filter((meal) => !meal.recipeId);
    if (!mealsToConfirm.length) {
      return {
        confirmedCount: 0,
        message: 'All meals already linked to recipes.',
      };
    }

    let confirmedCount = 0;
    for (const meal of mealsToConfirm) {
      const draft = await this.generation.generateRecipeDraftForMeal(
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
                id: newMealPlanId(),
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
            id: newMealPlanId(),
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
