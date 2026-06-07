import { Injectable } from '@nestjs/common';
import { NutritionService } from '../nutrition/nutrition.service';
import { RagService } from '../rag/rag.service';
import { NutritionToolsService } from '../nutrition-tools/nutrition-tools.service';
import { OpenAiClientService } from '../ai/openai-client.service';
import { MacroNutrition } from '../shared/units';
import {
  fitNutritionToTarget,
  slotCalorieBudget,
} from './meal-plan-nutrition.util';
import {
  pickGroundedRecipeId,
  pickRetrievedRecipeForVariety,
} from './meal-plan-rag.util';
import {
  enforceMealStructureSlots,
  fallbackMealStructure,
} from './meal-plan-structure.util';
import type { GenerationStep, MealSlot } from './meal-plans.types';

@Injectable()
export class MealPlanGenerationService {
  constructor(
    private readonly nutrition: NutritionService,
    private readonly rag: RagService,
    private readonly nutritionTools: NutritionToolsService,
    private readonly openai: OpenAiClientService,
  ) {}

  async runStep1(
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

  async runStep2(
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
Use preferred_meal_times when provided (keys: breakfast, lunch, dinner, snack, snack_2, snack_3, snack_4 — ISO timestamps). Respect meals_per_day and snacks_per_day slot counts.
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

  async buildPrefsFromProfile(userId: string) {
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
      preferred_meal_times: nutritionProfile?.preferredMealTimes ?? {},
      timezone: nutritionProfile?.timezone ?? 'UTC',
    };
  }

  /** Align AI structure with meals_per_day + snacks_per_day so calorie budgets stay correct. */
  enforceStructureSlots(
    structure: { meals: MealSlot[] },
    prefs: Record<string, unknown>,
    days: number,
    startDate: string,
    timezone: string,
  ): { meals: MealSlot[] } {
    return enforceMealStructureSlots(
      structure,
      prefs,
      days,
      startDate,
      timezone,
    );
  }

  async generateRecipeDraftForMeal(
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

  /** Generate a full recipe draft from a free-text catalog search request (Wingman). */
  async generateRecipeDraftFromQuery(
    query: string,
    prefs: Record<string, unknown>,
    opts?: { meal?: string; cuisine?: string },
  ) {
    const mealType = (opts?.meal ?? 'dinner').trim().toLowerCase();
    const title = query.trim().slice(0, 120) || 'Custom recipe';
    const fallback = await this.generateRecipeDraftForMeal(
      {
        title,
        mealType,
        nutrition: { calories: 0, protein: 0, carbs: 0, fats: 0 },
      },
      prefs,
    );
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
        'You generate complete recipe JSON for a wellness app catalog. Return strict JSON only.',
        `Create a complete recipe matching this user request.
Request: ${query.trim()}
Preferred meal type: ${mealType}
Preferred cuisine: ${opts?.cuisine ?? 'infer from request'}
User preferences: ${JSON.stringify({
          dietary_preferences: prefs.dietary_preferences ?? [],
          dietary_restrictions: prefs.dietary_restrictions ?? [],
          cuisine_preferences: prefs.cuisine_preferences ?? [],
          disliked_ingredients: prefs.disliked_ingredients ?? [],
        })}
Respect dietary restrictions. Include realistic ingredient quantities in grams.
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
        title: (generated.title || title).trim(),
        cuisine: (generated.cuisine || opts?.cuisine || fallback.cuisine).trim(),
        meal: (generated.meal || mealType).trim().toLowerCase(),
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

  async assignRecipeToSlot(
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
    const targetCalories = slotCalorieBudget(prefs, slot.mealType);
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
        const fitted = fitNutritionToTarget(scaled.perServing, targetCalories);
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

  generateFallbackMealTitle(
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

  async runStep3AssignRecipes(
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
          targetCalories: slotCalorieBudget(prefs, slot.mealType),
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

  pickRetrievedRecipe(
    retrieved: Array<{ id: string; title: string }>,
    usedIds: Set<string>,
  ) {
    return pickRetrievedRecipeForVariety(retrieved, usedIds);
  }

  fastGroundedSelection(
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

  async generateGroundedSelection(
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
      const recipeId = pickGroundedRecipeId(
        response.recipeId,
        retrieved.map((r) => r.id),
      );
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

  fallbackStructure(
    prefs: Record<string, unknown>,
    days: number,
    startDate: string,
    timezone: string,
  ): { meals: MealSlot[] } {
    return fallbackMealStructure(prefs, days, startDate, timezone);
  }
}
