import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { ProfileService } from '../profile/profile.service';
import { NutritionAnalyticsService } from '../nutrition-analytics/nutrition-analytics.service';
import { RecipesService } from '../recipes/recipes.service';

@Injectable()
export class AssistantToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly profile: ProfileService,
    private readonly nutritionAnalytics: NutritionAnalyticsService,
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

  private async getMealPlan(userId: string, args: Record<string, unknown>) {
    const date =
      typeof args.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.date)
        ? args.date
        : new Date().toISOString().slice(0, 10);

    const plan = await this.prisma.mealPlan.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        versions: {
          where: { isActive: true },
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

    if (!plan?.versions[0]) {
      return {
        date,
        error: 'no_active_meal_plan',
        message: 'No active meal plan. Generate one in the Nutrition tab.',
      };
    }

    const version = plan.versions[0];
    const dayIndex = this.dayIndexForDate(plan.startDate, date, plan.duration);
    const meals = version.meals
      .filter((m) => m.dayIndex === dayIndex)
      .map((m) => {
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
          calories: nutrition?.calories ?? null,
          protein: nutrition?.protein ?? null,
          carbs: nutrition?.carbs ?? null,
          fats: nutrition?.fats ?? null,
        };
      });

    return {
      date,
      planId: plan.id,
      versionId: version.id,
      duration: plan.duration,
      startDate: plan.startDate,
      dayIndex,
      meals,
      totalPlannedCalories: meals.reduce((s, m) => s + (m.calories ?? 0), 0),
    };
  }

  private async getRecipe(_userId: string, args: Record<string, unknown>) {
    const recipeId = args.recipe_id;
    if (typeof recipeId !== 'string' || !recipeId.trim()) {
      throw new BadRequestException('recipe_id is required');
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

  private dayIndexForDate(
    startDate: string,
    targetDate: string,
    duration: string,
  ): number {
    if (duration === 'daily') return 0;
    const start = new Date(`${startDate}T12:00:00.000Z`);
    const target = new Date(`${targetDate}T12:00:00.000Z`);
    const diff = Math.round((target.getTime() - start.getTime()) / 86400000);
    return Math.max(0, Math.min(6, diff));
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
