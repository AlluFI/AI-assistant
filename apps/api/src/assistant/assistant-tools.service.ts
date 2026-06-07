import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { NutritionProfile } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { ProfileService } from '../profile/profile.service';
import { NutritionProfileUpdateDto } from '../nutrition/dto/nutrition-profile-update.dto';
import { ProfileUpdateDto } from '../profile/dto/profile-update.dto';
import { NutritionService } from '../nutrition/nutrition.service';
import { NutritionAnalyticsService } from '../nutrition-analytics/nutrition-analytics.service';
import { RecipesService } from '../recipes/recipes.service';
import { isHiddenDemoMealPlanId } from '../shared/demo-meal-plan.util';
import {
  dayIndexForPlanDate,
  dateForPlanDay,
} from '../shared/meal-plan-date.util';
import { pickMealPlanForDate } from '../shared/meal-plan-resolve.util';
import {
  averageCheckInScore,
  dayCheckInScore,
} from '../analytics/check-in-wellness.util';
import { weekdayForDate } from './weekly-meal-plan-format.util';

/** Executes wingman tool calls against existing Nest services (JWT-scoped userId). */
@Injectable()
export class AssistantToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly profile: ProfileService,
    private readonly nutritionAnalytics: NutritionAnalyticsService,
    private readonly nutrition: NutritionService,
    private readonly recipes: RecipesService,
  ) {}

  async execute(userId: string, name: string, args: Record<string, unknown>) {
    switch (name) {
      case 'get_health_metrics':
        return this.getHealthMetrics(userId, args);
      case 'get_progress_summary':
        return this.getProgressSummary(userId, args);
      case 'get_meal_plan':
        return this.getMealPlan(userId, args);
      case 'get_recipe':
        return this.getRecipe(userId, args);
      case 'get_nutrition_summary':
        return this.getNutritionSummary(userId, args);
      case 'update_nutrition_targets':
        return this.updateNutritionTargets(userId, args);
      case 'update_nutrition_preferences':
        return this.updateNutritionPreferences(userId, args);
      case 'update_health_profile':
        return this.updateHealthProfile(userId, args);
      case 'get_daily_check_in':
        return this.getDailyCheckIn(userId, args);
      case 'get_chart_data':
        return this.getChartData(userId, args);
      case 'search_recipes':
        return this.searchRecipes(userId, args);
      default:
        throw new BadRequestException(`Unknown tool: ${name}`);
    }
  }

  private async getHealthMetrics(
    userId: string,
    args: Record<string, unknown>,
  ) {
    const metricType =
      this.enumArg(
        args.metric_type,
        ['bmi', 'weight', 'wellness_score', 'activity', 'all'],
        'metric_type',
      ) ?? 'all';
    const period =
      this.enumArg(
        args.time_period,
        ['current', 'weekly', 'monthly'],
        'time_period',
        false,
      ) ?? 'current';

    const days = period === 'monthly' ? 30 : period === 'weekly' ? 7 : 1;
    const [summary, profilePayload, metrics] = await Promise.all([
      this.analytics.getSummary(userId),
      this.profile.get(userId),
      this.profile.listMetrics(userId, days, 10),
    ]);
    const profile = profilePayload.profile as Record<string, unknown> | null;
    const latest = metrics[0];

    const weightKg =
      latest?.weightKg ??
      (profile?.weightKg as number | null | undefined) ??
      null;
    const heightCm = (profile?.heightCm as number | null) ?? null;
    const bmi =
      summary.bmi ??
      (weightKg && heightCm
        ? this.analytics.computeBmi(weightKg, heightCm)
        : null);

    const payload: Record<string, unknown> = {
      metric_type: metricType,
      time_period: period,
      weightKg,
      heightCm,
      bmi,
      bmiClassification: summary.bmiClassification,
      wellnessScore: summary.wellnessScore,
      wellnessComponents: summary.components,
      activityLevel: profile?.activityLevel ?? null,
      weeklyActivityDays:
        latest?.weeklyActivityDays ?? profile?.weeklyActivityDays,
      latestMetricAt: latest?.recordedAt ?? summary.latestMetricAt,
    };

    if (metricType && metricType !== 'all') {
      return this.pickMetrics(payload, metricType);
    }
    return payload;
  }

  private pickMetrics(payload: Record<string, unknown>, metricType: string) {
    const map: Record<string, string[]> = {
      bmi: ['bmi', 'bmiClassification', 'heightCm', 'weightKg'],
      weight: ['weightKg', 'latestMetricAt'],
      wellness_score: ['wellnessScore', 'wellnessComponents'],
      activity: ['activityLevel', 'weeklyActivityDays'],
    };
    const keys = map[metricType] ?? [];
    const out: Record<string, unknown> = { metric_type: metricType };
    for (const k of keys) out[k] = payload[k];
    return out;
  }

  private async getProgressSummary(
    userId: string,
    args: Record<string, unknown>,
  ) {
    const focus =
      this.enumArg(
        args.focus,
        ['weight', 'wellness', 'goals', 'all'],
        'focus',
        false,
      ) ?? 'all';

    const [profilePayload, summary, weightSeries] = await Promise.all([
      this.profile.get(userId),
      this.analytics.getSummary(userId),
      this.analytics.weightSeries(userId, 30),
    ]);
    const profile = profilePayload.profile as Record<string, unknown> | null;
    const current =
      weightSeries.length > 0
        ? weightSeries[weightSeries.length - 1].weightKg
        : (profile?.weightKg as number | null);
    const target = profile?.targetWeightKg as number | null;
    const goalRaw = profile?.fitnessGoalPrimary;
    const goal = typeof goalRaw === 'string' ? goalRaw : '';

    let trendSummary = 'insufficient data';
    if (weightSeries.length >= 2) {
      const first = weightSeries[0].weightKg;
      const last = weightSeries[weightSeries.length - 1].weightKg;
      if (first != null && last != null) {
        const delta = Number((last - first).toFixed(2));
        trendSummary =
          delta < -0.2
            ? `down about ${Math.abs(delta)} kg over ${weightSeries.length} points`
            : delta > 0.2
              ? `up about ${delta} kg over ${weightSeries.length} points`
              : 'relatively stable';
      }
    }

    const kgToGoal =
      current != null && target != null
        ? Number((current - target).toFixed(2))
        : null;

    return {
      focus,
      fitnessGoalPrimary: profile?.fitnessGoalPrimary ?? null,
      desiredActivityLevel: profile?.desiredActivityLevel ?? null,
      currentWeightKg: current,
      targetWeightKg: target,
      kgToGoal,
      weightTrend30d: trendSummary,
      wellnessScore: summary.wellnessScore,
      wellnessComponents: summary.components,
      dietaryPreferences: profile?.dietaryPreferences ?? [],
      dietaryRestrictions: profile?.dietaryRestrictions ?? [],
      goalInterpretation:
        goal.includes('loss') && kgToGoal != null && kgToGoal > 0
          ? `${kgToGoal} kg above target`
          : goal.includes('gain') && kgToGoal != null && kgToGoal < 0
            ? `${Math.abs(kgToGoal)} kg below target`
            : null,
    };
  }

  private mapPlannedMeal(m: {
    id: string;
    mealType: string;
    title: string;
    scheduledAt: Date;
    recipeId: string | null;
    recipe: { id: string; title: string; timeMinutes: number } | null;
    nutrition: unknown;
  }) {
    const nutrition = m.nutrition as {
      calories?: number;
      protein?: number;
      carbs?: number;
      fats?: number;
    } | null;
    return {
      id: m.id,
      mealType: m.mealType,
      title: m.title,
      scheduledAt: m.scheduledAt,
      recipeId: m.recipeId,
      recipeTitle: m.recipe?.title ?? null,
      recipeLinked: Boolean(m.recipeId),
      calories: nutrition?.calories ?? null,
      protein: nutrition?.protein ?? null,
      carbs: nutrition?.carbs ?? null,
      fats: nutrition?.fats ?? null,
    };
  }

  private async getMealPlan(userId: string, args: Record<string, unknown>) {
    const scope =
      this.enumArg(args.scope, ['day', 'week'], 'scope', false) ?? 'day';
    const date =
      typeof args.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.date)
        ? args.date
        : new Date().toISOString().slice(0, 10);

    const plans = await this.prisma.mealPlan.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        versions: {
          orderBy: [{ isActive: 'desc' }, { versionNumber: 'desc' }],
          take: 1,
          include: {
            meals: {
              orderBy: [{ dayIndex: 'asc' }, { sortOrder: 'asc' }],
              include: {
                recipe: {
                  select: { id: true, title: true, timeMinutes: true },
                },
              },
            },
          },
        },
      },
    });

    const plan = pickMealPlanForDate(plans, date, isHiddenDemoMealPlanId);

    if (!plan?.versions[0]) {
      return {
        scope,
        date,
        error: 'no_active_meal_plan',
        message: 'No active meal plan. Generate one in the Nutrition tab.',
      };
    }

    const version = plan.versions[0];
    const allMeals = version.meals;

    if (scope === 'week' && plan.duration === 'weekly') {
      const planDayCount = 7;
      const days = [];
      for (let dayIndex = 0; dayIndex < planDayCount; dayIndex += 1) {
        const date = dateForPlanDay(plan.startDate, dayIndex);
        const dayMeals = allMeals
          .filter((m) => m.dayIndex === dayIndex)
          .map((m) => this.mapPlannedMeal(m));
        days.push({
          dayIndex,
          date,
          weekday: weekdayForDate(date),
          meals: dayMeals,
          totalPlannedCalories: dayMeals.reduce(
            (s, m) => s + (m.calories ?? 0),
            0,
          ),
        });
      }
      const missingDayIndexes = days
        .filter((d) => d.meals.length === 0)
        .map((d) => d.dayIndex);
      return {
        scope: 'week',
        planId: plan.id,
        versionId: version.id,
        duration: plan.duration,
        startDate: plan.startDate,
        endDate: dateForPlanDay(plan.startDate, planDayCount - 1),
        dayCount: planDayCount,
        days,
        missingDayIndexes,
        note: 'List every day in days (dayCount=7). Meals differ by day — never omit the last day.',
      };
    }

    const dayIndex = dayIndexForPlanDate(plan.startDate, date, plan.duration);
    const meals = allMeals
      .filter((m) => m.dayIndex === dayIndex)
      .map((m) => this.mapPlannedMeal(m));

    return {
      scope: 'day',
      date,
      planId: plan.id,
      versionId: version.id,
      duration: plan.duration,
      startDate: plan.startDate,
      dayIndex,
      meals,
      totalPlannedCalories: meals.reduce((s, m) => s + (m.calories ?? 0), 0),
      weekHint:
        plan.duration === 'weekly'
          ? 'For all 7 days, call again with scope "week".'
          : undefined,
    };
  }

  private async getRecipe(userId: string, args: Record<string, unknown>) {
    let recipeId =
      typeof args.recipe_id === 'string' ? args.recipe_id.trim() : '';

    if (!recipeId) {
      const date =
        typeof args.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.date)
          ? args.date
          : undefined;
      const mealType = this.enumArg(
        args.meal_type,
        ['breakfast', 'lunch', 'dinner', 'snack'],
        'meal_type',
        false,
      );
      if (date && mealType) {
        const resolved = await this.resolveRecipeFromMealPlan(
          userId,
          date,
          mealType,
        );
        if ('error' in resolved) return resolved;
        recipeId = resolved.recipeId;
      }
    }

    if (!recipeId) {
      throw new BadRequestException(
        'recipe_id is required, or provide date and meal_type from the meal plan',
      );
    }
    const recipe = await this.recipes.getById(recipeId.trim());
    return {
      id: recipe.id,
      title: recipe.title,
      servings: recipe.servings,
      timeMinutes: recipe.time,
      cuisine: recipe.cuisine,
      summary: recipe.summary,
      preparation: recipe.preparation,
      ingredients: recipe.ingredients,
      nutritionPerServing: recipe.nutrition,
    };
  }

  private async resolveRecipeFromMealPlan(
    userId: string,
    date: string,
    mealType: string,
  ): Promise<
    | { recipeId: string; title: string }
    | {
        error: string;
        message: string;
        date: string;
        meal_type: string;
        title?: string;
      }
  > {
    const plan = await this.getMealPlan(userId, { date });
    if ('error' in plan && plan.error) {
      return {
        error: String(plan.error),
        message: String(plan.message ?? 'No meal plan available.'),
        date,
        meal_type: mealType,
      };
    }

    const meals = (
      plan as {
        meals: Array<{
          mealType: string;
          recipeId: string | null;
          title: string;
        }>;
      }
    ).meals;
    const slot = meals.find((m) => m.mealType === mealType);
    if (!slot) {
      return {
        error: 'no_meal_slot',
        message: `No ${mealType} slot on your meal plan for ${date}.`,
        date,
        meal_type: mealType,
      };
    }
    if (!slot.recipeId) {
      return {
        error: 'no_recipe_linked',
        message:
          'This meal has no recipe linked yet. Open the Nutrition tab, confirm recipes on your meal plan, or regenerate the meal.',
        date,
        meal_type: mealType,
        title: slot.title,
      };
    }
    return { recipeId: slot.recipeId, title: slot.title };
  }

  private async updateNutritionTargets(
    userId: string,
    args: Record<string, unknown>,
  ) {
    const mode = this.enumArg(
      args.mode,
      ['ai_recommend', 'formula', 'manual'],
      'mode',
    );
    if (!mode) {
      throw new BadRequestException('mode is required');
    }

    try {
      if (mode === 'ai_recommend') {
        const row = await this.nutrition.applyAiSuggestedTargets(userId);
        return this.formatNutritionTargetsResult(row);
      }
      if (mode === 'formula') {
        const row = await this.nutrition.applySuggestedTargets(userId);
        return this.formatNutritionTargetsResult(row);
      }

      const cal =
        args.calories != null ? Math.round(Number(args.calories)) : undefined;
      const protein =
        args.protein != null ? Math.round(Number(args.protein)) : undefined;
      const carbs =
        args.carbs != null ? Math.round(Number(args.carbs)) : undefined;
      const fats =
        args.fats != null ? Math.round(Number(args.fats)) : undefined;

      if (
        cal == null &&
        protein == null &&
        carbs == null &&
        fats == null
      ) {
        throw new BadRequestException(
          'manual mode requires calories and/or protein, carbs, and fats',
        );
      }

      const patch: NutritionProfileUpdateDto = {};

      if (cal != null) {
        if (!Number.isFinite(cal) || cal < 800 || cal > 6000) {
          throw new BadRequestException(
            'calories must be between 800 and 6000',
          );
        }
        patch.calorieTarget = cal;
        patch.calorieTargetSource = 'manual';
      }

      const macroCount = [protein, carbs, fats].filter((v) => v != null).length;
      if (macroCount > 0 && macroCount < 3) {
        throw new BadRequestException(
          'manual mode requires protein, carbs, and fats together',
        );
      }
      if (protein != null && carbs != null && fats != null) {
        if (
          !Number.isFinite(protein) ||
          !Number.isFinite(carbs) ||
          !Number.isFinite(fats) ||
          protein < 40 ||
          protein > 400 ||
          carbs < 50 ||
          carbs > 800 ||
          fats < 20 ||
          fats > 250
        ) {
          throw new BadRequestException('macro values are out of allowed range');
        }
        patch.macroTargets = { protein, carbs, fats };
      }

      const row = await this.nutrition.upsertNutritionProfile(userId, patch);
      return this.formatNutritionTargetsResult(row);
    } catch (e) {
      if (e instanceof NotFoundException) {
        return {
          updated: false,
          error: 'insufficient_profile',
          message:
            'Add weight, height, and age in your health profile before recommending targets.',
        };
      }
      if (e instanceof ServiceUnavailableException) {
        return {
          updated: false,
          error: 'ai_unavailable',
          message:
            'AI recommendations are not configured. Use formula mode or set targets manually in the Nutrition tab.',
        };
      }
      throw e;
    }
  }

  private formatNutritionTargetsResult(
    row: NutritionProfile & { recommendationRationale?: string | null },
  ) {
    const macros = row.macroTargets as {
      protein?: number;
      carbs?: number;
      fats?: number;
    } | null;
    return {
      updated: true,
      calorieTarget: row.calorieTarget,
      calorieTargetSource: row.calorieTargetSource,
      macroTargets: macros
        ? {
            protein: macros.protein ?? null,
            carbs: macros.carbs ?? null,
            fats: macros.fats ?? null,
          }
        : null,
      recommendationRationale: row.recommendationRationale ?? null,
      message:
        'Saved calorie and macro targets. Meal plans and nutrition summaries will use these values.',
    };
  }

  private async updateHealthProfile(
    userId: string,
    args: Record<string, unknown>,
  ) {
    const dto: ProfileUpdateDto = {};
    if (args.age != null) {
      const age = Math.round(Number(args.age));
      if (!Number.isFinite(age) || age < 10 || age > 120) {
        throw new BadRequestException('age must be between 10 and 120');
      }
      dto.age = age;
    }
    if (args.gender != null) {
      dto.gender = this.enumArg(
        args.gender,
        ['female', 'male', 'non_binary', 'prefer_not_say', 'other'],
        'gender',
      ) ?? undefined;
    }
    if (args.height_cm != null) {
      const h = Number(args.height_cm);
      if (!Number.isFinite(h) || h < 50 || h > 260) {
        throw new BadRequestException('height_cm must be between 50 and 260');
      }
      dto.heightCm = h;
    }
    if (args.weight_kg != null) {
      const w = Number(args.weight_kg);
      if (!Number.isFinite(w) || w < 20 || w > 400) {
        throw new BadRequestException('weight_kg must be between 20 and 400');
      }
      dto.weightKg = w;
      dto.startingWeightKg = w;
    }
    if (args.activity_level != null) {
      dto.activityLevel = this.enumArg(
        args.activity_level,
        ['sedentary', 'light', 'moderate', 'active', 'very_active'],
        'activity_level',
      ) ?? undefined;
    }
    if (args.fitness_goal != null) {
      dto.fitnessGoalPrimary = this.enumArg(
        args.fitness_goal,
        ['weight_loss', 'muscle_gain', 'general_fitness', 'maintenance'],
        'fitness_goal',
      ) ?? undefined;
    }

    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'Provide at least one of age, gender, height_cm, weight_kg, activity_level, fitness_goal',
      );
    }

    const result = await this.profile.upsert(userId, dto);
    return {
      updated: true,
      profile: result.profile,
      message: 'Saved health profile fields.',
    };
  }

  private async updateNutritionPreferences(
    userId: string,
    args: Record<string, unknown>,
  ) {
    const patch: NutritionProfileUpdateDto = {};

    if (args.meals_per_day != null) {
      const meals = Math.round(Number(args.meals_per_day));
      if (!Number.isFinite(meals) || meals < 1 || meals > 6) {
        throw new BadRequestException('meals_per_day must be between 1 and 6');
      }
      patch.mealsPerDay = meals;
    }

    if (args.snacks_per_day != null) {
      const snacks = Math.round(Number(args.snacks_per_day));
      if (!Number.isFinite(snacks) || snacks < 0 || snacks > 4) {
        throw new BadRequestException('snacks_per_day must be between 0 and 4');
      }
      patch.snacksPerDay = snacks;
    }

    const timesRaw = args.preferred_meal_times;
    if (timesRaw != null) {
      if (typeof timesRaw !== 'object' || Array.isArray(timesRaw)) {
        throw new BadRequestException(
          'preferred_meal_times must be an object of slot keys to HH:MM strings',
        );
      }
      const out: Record<string, string> = {};
      for (const [key, val] of Object.entries(
        timesRaw as Record<string, unknown>,
      )) {
        if (typeof val !== 'string' || !/^\d{1,2}:\d{2}$/.test(val.trim())) {
          throw new BadRequestException(
            `preferred_meal_times.${key} must be HH:MM (24h)`,
          );
        }
        const [h, m] = val.trim().split(':').map(Number);
        if (h < 0 || h > 23 || m < 0 || m > 59) {
          throw new BadRequestException(`Invalid time for ${key}`);
        }
        const d = new Date('2026-01-01T12:00:00.000Z');
        d.setUTCHours(h, m, 0, 0);
        out[key] = d.toISOString();
      }
      patch.preferredMealTimes = out;
    }

    if (
      patch.mealsPerDay === undefined &&
      patch.snacksPerDay === undefined &&
      patch.preferredMealTimes === undefined
    ) {
      throw new BadRequestException(
        'Provide meals_per_day, snacks_per_day, and/or preferred_meal_times',
      );
    }

    const row = await this.nutrition.upsertNutritionProfile(userId, patch);
    return {
      updated: true,
      mealsPerDay: row.mealsPerDay,
      snacksPerDay: row.snacksPerDay,
      preferredMealTimes: row.preferredMealTimes,
      message:
        'Saved meal schedule preferences. New meal plans will use these times.',
    };
  }

  private async getDailyCheckIn(
    userId: string,
    args: Record<string, unknown>,
  ) {
    const period =
      this.enumArg(args.period, ['day', 'week'], 'period') ?? 'day';
    const date =
      typeof args.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.date)
        ? args.date
        : new Date().toISOString().slice(0, 10);

    if (period === 'week') {
      const end = new Date(`${date}T12:00:00.000Z`);
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 6);
      const startDate = start.toISOString().slice(0, 10);
      const rows = await this.prisma.dailyCheckIn.findMany({
        where: { userId, date: { gte: startDate, lte: date } },
        orderBy: { date: 'asc' },
      });
      const mapped = rows.map((r) => ({
        date: r.date,
        sleepHours: r.sleepHours,
        waterGlasses: r.waterGlasses,
        mood: r.mood,
        steps: r.steps,
        source: r.source,
        dayScore: dayCheckInScore({
          sleepHours: r.sleepHours,
          waterGlasses: r.waterGlasses,
          mood: r.mood,
        }),
      }));
      const weekHabitsScore = averageCheckInScore(
        rows.map((r) => ({
          sleepHours: r.sleepHours,
          waterGlasses: r.waterGlasses,
          mood: r.mood,
        })),
      );
      return {
        period: 'week',
        startDate,
        endDate: date,
        days: mapped,
        weekHabitsScore,
        wellnessNote:
          weekHabitsScore != null
            ? '7-day check-in habits average contributes ~12.5% to your wellness score.'
            : 'Log sleep, water, or mood in Overview → Daily check-in to affect wellness score.',
      };
    }

    const row = await this.prisma.dailyCheckIn.findUnique({
      where: { userId_date: { userId, date } },
    });
    const weekHabitsScore = await this.analytics.recentCheckInHabitsScore(
      userId,
      7,
    );
    return {
      period: 'day',
      date,
      checkIn: row
        ? {
            sleepHours: row.sleepHours,
            waterGlasses: row.waterGlasses,
            mood: row.mood,
            steps: row.steps,
            source: row.source,
          }
        : null,
      dayScore: row
        ? dayCheckInScore({
            sleepHours: row.sleepHours,
            waterGlasses: row.waterGlasses,
            mood: row.mood,
          })
        : null,
      weekHabitsScore,
      wellnessNote:
        weekHabitsScore != null
          ? '7-day check-in habits average contributes ~12.5% to your wellness score.'
          : 'No recent check-in data — log sleep, water, or mood on Overview.',
    };
  }

  private async getNutritionSummary(
    userId: string,
    args: Record<string, unknown>,
  ) {
    const period =
      this.enumArg(args.period, ['day', 'week'], 'period') ?? 'day';
    const date =
      typeof args.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.date)
        ? args.date
        : new Date().toISOString().slice(0, 10);

    if (period === 'day') {
      return this.nutritionAnalytics.dailySummary(userId, date);
    }
    return this.nutritionAnalytics.weeklySummary(userId, date);
  }

  private async searchRecipes(userId: string, args: Record<string, unknown>) {
    const query = typeof args.query === 'string' ? args.query.trim() : '';
    const cuisine = typeof args.cuisine === 'string' ? args.cuisine : undefined;
    const meal = typeof args.meal === 'string' ? args.meal : undefined;
    const maxPrep =
      args.max_prep_minutes != null ? Number(args.max_prep_minutes) : undefined;
    const limitRaw = args.limit != null ? Number(args.limit) : 8;
    const limit = Math.min(15, Math.max(1, Math.round(limitRaw) || 8));

    const profilePayload = await this.profile.get(userId);
    const profile = profilePayload.profile as Record<string, unknown> | null;
    const allergies =
      (profile?.dietaryRestrictions as string[] | undefined) ?? [];

    const results = await this.recipes.search({
      q: query || undefined,
      cuisine,
      meal,
      maxPrepMinutes:
        maxPrep != null && Number.isFinite(maxPrep) ? maxPrep : undefined,
      limit,
      allergies,
    });

    return {
      query: query || null,
      count: results.length,
      canCreateRecipe: results.length === 0,
      recipes: results.map((r) => ({
        id: r.id,
        title: r.title,
        cuisine: r.cuisine,
        meal: r.meal,
        timeMinutes: r.time,
        summary: r.summary,
        nutrition: r.nutrition,
        relevanceScore:
          'relevanceScore' in r
            ? (r as { relevanceScore?: number }).relevanceScore
            : undefined,
      })),
    };
  }

  private async getChartData(userId: string, args: Record<string, unknown>) {
    const chartType = this.enumArg(
      args.chart_type,
      ['weight_trend', 'calorie_trend', 'protein_vs_target', 'macro_breakdown'],
      'chart_type',
    );
    const days = this.clampDays(args.days);

    if (chartType === 'weight_trend') {
      const series = await this.analytics.weightSeries(userId, days);
      return { chart_type: chartType, days, series };
    }

    if (chartType === 'calorie_trend') {
      const series = await this.nutritionAnalytics.trend(userId, days);
      return { chart_type: chartType, days, series };
    }

    const daily = await this.nutritionAnalytics.dailySummary(
      userId,
      new Date().toISOString().slice(0, 10),
    );
    if (chartType === 'protein_vs_target') {
      return {
        chart_type: chartType,
        date: daily.date,
        proteinIntake: daily.intake.protein,
        proteinTarget: daily.target.macros.protein,
        percent: daily.macroPercentOfTarget.protein,
      };
    }

    return {
      chart_type: 'macro_breakdown',
      date: daily.date,
      intake: daily.intake,
      target: daily.target.macros,
    };
  }

  private enumArg(
    value: unknown,
    allowed: string[],
    field: string,
    required = true,
  ): string | undefined {
    if (value === undefined || value === null || value === '') {
      if (required) {
        throw new BadRequestException(`${field} is required`);
      }
      return undefined;
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new BadRequestException(`${field} must be a string`);
    }
    const s = String(value);
    if (!allowed.includes(s)) {
      throw new BadRequestException(
        `${field} must be one of: ${allowed.join(', ')}`,
      );
    }
    return s;
  }

  private clampDays(value: unknown): number {
    const n = Number(value ?? 30);
    if (!Number.isFinite(n)) return 30;
    return Math.min(90, Math.max(7, Math.round(n)));
  }
}
