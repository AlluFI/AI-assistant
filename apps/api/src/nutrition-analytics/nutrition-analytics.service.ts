import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAiClientService } from '../ai/openai-client.service';
import { NutritionService } from '../nutrition/nutrition.service';
import {
  addMicronutrients,
  emptyMicronutrients,
  MICRONUTRIENT_FOOD_SUGGESTIONS,
  MICRONUTRIENT_KEYS,
  MICRONUTRIENT_LABELS,
  MICRONUTRIENT_RDA,
  MICRONUTRIENT_UNITS,
  micronutrientsFromMealNutrition,
  percentOfMicronutrientTarget,
  type MicronutrientKey,
  type MicronutrientMap,
} from '../shared/micronutrients';
import { addMacros, emptyMacros, MacroNutrition } from '../shared/units';

@Injectable()
export class NutritionAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nutrition: NutritionService,
    private readonly openai: OpenAiClientService,
  ) {}

  async dailySummary(userId: string, date: string) {
    const combined = await this.nutrition.getCombinedProfile(userId);
    const target =
      combined.nutritionProfile?.calorieTarget ??
      combined.suggestedTargets?.calories ??
      2000;
    const macroTargets = (combined.nutritionProfile
      ?.macroTargets as MacroNutrition | null) ??
      combined.suggestedTargets?.macros ?? {
        protein: 100,
        carbs: 200,
        fats: 60,
      };

    const intake = await this.sumEatenOnDate(userId, date);
    const planned = await this.plannedMealsForCalendarDate(userId, date);
    const plannedIntake = sumMealNutrition(planned);
    const mealsEaten = await this.countEatenOnDate(userId, date);
    const deficit = target - intake.calories;
    return {
      date,
      target: { calories: target, macros: macroTargets },
      intake,
      plannedIntake,
      mealsEaten,
      mealsPlanned: planned.length,
      deficit,
      surplus: deficit < 0 ? Math.abs(deficit) : 0,
      macroPercentOfTarget: {
        protein: pct(intake.protein, macroTargets.protein),
        carbs: pct(intake.carbs, macroTargets.carbs),
        fats: pct(intake.fats, macroTargets.fats),
      },
      status:
        deficit > 100 ? 'deficit' : deficit < -100 ? 'surplus' : 'on_track',
    };
  }

  async weeklySummary(userId: string, endDate?: string) {
    const end = endDate ?? new Date().toISOString().slice(0, 10);
    const startDate = new Date(`${end}T12:00:00.000Z`);
    startDate.setUTCDate(startDate.getUTCDate() - 6);
    const start = startDate.toISOString().slice(0, 10);

    const combined = await this.nutrition.getCombinedProfile(userId);
    const target =
      combined.nutritionProfile?.calorieTarget ??
      combined.suggestedTargets?.calories ??
      2000;

    const daily: Array<{ date: string; calories: number; deficit: number }> =
      [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(`${start}T12:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() + i);
      const date = d.toISOString().slice(0, 10);
      const intake = await this.sumEatenOnDate(userId, date);
      daily.push({
        date,
        calories: intake.calories,
        deficit: target - intake.calories,
      });
    }

    const rangeTotals = await this.sumEatenInRange(userId, start, end);
    const daysWithIntake = daily.filter((d) => d.calories > 0);
    const totalCalories = daily.reduce((s, d) => s + d.calories, 0);
    const avgCalories = daysWithIntake.length
      ? Math.round(totalCalories / daysWithIntake.length)
      : 0;
    const avgDeficit = daysWithIntake.length
      ? Math.round(
          daysWithIntake.reduce((s, d) => s + d.deficit, 0) /
            daysWithIntake.length,
        )
      : 0;

    return {
      start,
      end,
      targetCalories: target,
      days: daysWithIntake.length,
      avgCalories,
      avgDeficit,
      totalProtein: rangeTotals.protein,
      totalCarbs: rangeTotals.carbs,
      totalFats: rangeTotals.fats,
      daily,
    };
  }

  async micronutrientReport(userId: string, endDate?: string, daysRaw = 7) {
    const days = Math.min(90, Math.max(1, daysRaw));
    const end = endDate ?? new Date().toISOString().slice(0, 10);
    const startDate = new Date(`${end}T12:00:00.000Z`);
    startDate.setUTCDate(startDate.getUTCDate() - (days - 1));
    const start = startDate.toISOString().slice(0, 10);

    const { start: rangeStart } = this.dayBoundsUtc(start);
    const { end: rangeEnd } = this.dayBoundsUtc(end);
    const meals = await this.prisma.plannedMeal.findMany({
      where: {
        eatenAt: { gte: rangeStart, lte: rangeEnd },
        version: { isActive: true, mealPlan: { userId } },
      },
      select: { eatenAt: true, nutrition: true },
    });

    const byDate = new Map<string, MicronutrientMap>();
    for (const meal of meals) {
      if (!meal.eatenAt) continue;
      const date = meal.eatenAt.toISOString().slice(0, 10);
      const prev = byDate.get(date) ?? emptyMicronutrients();
      byDate.set(
        date,
        addMicronutrients(
          prev,
          micronutrientsFromMealNutrition(meal.nutrition),
        ),
      );
    }

    const daysWithIntake = [...byDate.values()];
    const periodTotal = daysWithIntake.reduce(
      (acc, day) => addMicronutrients(acc, day),
      emptyMicronutrients(),
    );
    const dayCount = daysWithIntake.length;
    const avgDaily: MicronutrientMap = emptyMicronutrients();
    for (const key of MICRONUTRIENT_KEYS) {
      avgDaily[key] =
        dayCount > 0 ? Math.round((periodTotal[key] / dayCount) * 10) / 10 : 0;
    }

    const percentOfTarget = Object.fromEntries(
      MICRONUTRIENT_KEYS.map((key) => [
        key,
        percentOfMicronutrientTarget(key, avgDaily[key]),
      ]),
    ) as Record<MicronutrientKey, number>;

    const deficiencies: string[] = [];
    const excesses: string[] = [];
    const suggestions: string[] = [];

    for (const key of MICRONUTRIENT_KEYS) {
      const pct = percentOfTarget[key];
      const label = MICRONUTRIENT_LABELS[key];
      const unit = MICRONUTRIENT_UNITS[key];
      const foods = MICRONUTRIENT_FOOD_SUGGESTIONS[key];

      if (key === 'sodium') {
        if (pct > 115) {
          excesses.push(
            `${label} is above the recommended max (${avgDaily[key]} ${unit} avg vs ${MICRONUTRIENT_RDA[key]} ${unit}).`,
          );
          suggestions.push(
            `Reduce sodium: try ${foods.slice(0, 2).join(', ')}.`,
          );
        }
        continue;
      }

      if (dayCount === 0) continue;
      if (pct < 85) {
        deficiencies.push(
          `${label} is below target (${avgDaily[key]} ${unit}/day avg, ${pct}% of RDA).`,
        );
        suggestions.push(
          `Boost ${label.toLowerCase()}: add ${foods.slice(0, 3).join(', ')}.`,
        );
      }
    }

    if (dayCount === 0) {
      suggestions.push(
        'Log eaten meals from your meal plan (or use demo seed data) to track micronutrients.',
      );
    }

    return {
      start,
      end,
      days,
      daysWithIntake: dayCount,
      targets: MICRONUTRIENT_RDA,
      labels: MICRONUTRIENT_LABELS,
      units: MICRONUTRIENT_UNITS,
      avgDaily,
      percentOfTarget,
      deficiencies,
      excesses,
      suggestions: [...new Set(suggestions)].slice(0, 8),
      foodsByNutrient: MICRONUTRIENT_FOOD_SUGGESTIONS,
    };
  }

  async trend(userId: string, days = 30) {
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - days + 1);
    const startIso = start.toISOString().slice(0, 10);
    const endIso = end.toISOString().slice(0, 10);

    const combined = await this.nutrition.getCombinedProfile(userId);
    const target =
      combined.nutritionProfile?.calorieTarget ??
      combined.suggestedTargets?.calories ??
      2000;

    const byDate = await this.eatenByDateInRange(userId, startIso, endIso);
    const result: Array<{
      date: string;
      calories: number;
      deficit: number;
      protein: number;
      carbs: number;
      fats: number;
    }> = [];

    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      const date = d.toISOString().slice(0, 10);
      const intake = byDate.get(date) ?? emptyMacros();
      result.push({
        date,
        calories: intake.calories,
        deficit: target - intake.calories,
        protein: intake.protein,
        carbs: intake.carbs,
        fats: intake.fats,
      });
    }
    return result;
  }

  async aiInsights(userId: string, endDate?: string) {
    const weekly = await this.weeklySummary(userId, endDate);
    const combined = await this.nutrition.getCombinedProfile(userId);
    const targetMacros = (combined.nutritionProfile?.macroTargets as
      | { protein: number; carbs: number; fats: number }
      | undefined) ?? {
      protein: 100,
      carbs: 200,
      fats: 60,
    };
    const intakeDays = weekly.daily.filter((d) => d.calories > 0);
    const streakInDeficit = this.calculateDeficitStreak(weekly.daily);
    const severeDeficitDays = weekly.daily.filter(
      (d) => d.deficit > 500,
    ).length;
    const severeSurplusDays = weekly.daily.filter(
      (d) => d.deficit < -500,
    ).length;
    const baseline = {
      achievements: [
        streakInDeficit >= 3
          ? `Stayed in caloric deficit for ${streakInDeficit} days in a row.`
          : 'Nutrition logging is active this week.',
      ],
      concerns: [
        severeDeficitDays > 0
          ? `Deficit exceeded 500 kcal on ${severeDeficitDays} day(s).`
          : undefined,
        severeSurplusDays > 0
          ? `Surplus exceeded 500 kcal on ${severeSurplusDays} day(s).`
          : undefined,
      ].filter((x): x is string => Boolean(x)),
      macroBalance: {
        protein: this.balanceLabel(
          weekly.totalProtein / Math.max(intakeDays.length, 1),
          targetMacros.protein,
        ),
        carbs: this.balanceLabel(
          weekly.totalCarbs / Math.max(intakeDays.length, 1),
          targetMacros.carbs,
        ),
        fats: this.balanceLabel(
          weekly.totalFats / Math.max(intakeDays.length, 1),
          targetMacros.fats,
        ),
      },
      suggestions: [
        'Add one protein-focused meal to improve satiety and recovery.',
        'Shift calories earlier in the day if evening overeating is common.',
        'Use portion reductions of 10-15% for high-calorie meals when in surplus.',
      ],
      usedFallback: true,
    };

    if (!this.openai.apiKey) return baseline;

    const healthProfile = (combined.healthProfile ?? null) as Record<
      string,
      unknown
    > | null;
    const dietaryRestrictions = Array.isArray(
      healthProfile?.dietaryRestrictions,
    )
      ? healthProfile.dietaryRestrictions.filter(
          (x): x is string => typeof x === 'string',
        )
      : [];
    const dietaryPreferences = Array.isArray(healthProfile?.dietaryPreferences)
      ? healthProfile.dietaryPreferences.filter(
          (x): x is string => typeof x === 'string',
        )
      : [];
    const fitnessGoal =
      typeof healthProfile?.fitnessGoal === 'string'
        ? healthProfile.fitnessGoal
        : null;
    try {
      const ai = await this.openai.chatJson<{
        achievements: string[];
        concerns: string[];
        macroBalance: { protein: string; carbs: string; fats: string };
        suggestions: string[];
      }>(
        'You are a nutrition coach. Return strict JSON only with achievements, concerns, macroBalance, suggestions. Keep tone concise and practical.',
        `Generate insights from this weekly nutrition summary:
${JSON.stringify({
  weekly,
  targets: { calories: weekly.targetCalories, macros: targetMacros },
  profile: {
    dietaryRestrictions,
    dietaryPreferences,
    fitnessGoal,
  },
})}`,
        { temperature: 0.3, topP: 0.9 },
      );
      return {
        achievements: Array.isArray(ai.achievements)
          ? ai.achievements.slice(0, 5)
          : baseline.achievements,
        concerns: Array.isArray(ai.concerns)
          ? ai.concerns.slice(0, 5)
          : baseline.concerns,
        macroBalance:
          ai.macroBalance &&
          typeof ai.macroBalance.protein === 'string' &&
          typeof ai.macroBalance.carbs === 'string' &&
          typeof ai.macroBalance.fats === 'string'
            ? ai.macroBalance
            : baseline.macroBalance,
        suggestions: Array.isArray(ai.suggestions)
          ? ai.suggestions.slice(0, 6)
          : baseline.suggestions,
        usedFallback: false,
      };
    } catch {
      return baseline;
    }
  }

  private dayBoundsUtc(date: string) {
    return {
      start: new Date(`${date}T00:00:00.000Z`),
      end: new Date(`${date}T23:59:59.999Z`),
    };
  }

  private async sumEatenOnDate(
    userId: string,
    date: string,
  ): Promise<MacroNutrition> {
    const { start, end } = this.dayBoundsUtc(date);
    const meals = await this.prisma.plannedMeal.findMany({
      where: {
        eatenAt: { gte: start, lte: end },
        version: { isActive: true, mealPlan: { userId } },
      },
      select: { nutrition: true },
    });
    const fromPlan = sumMealNutrition(meals);
    const fromLogs = await this.sumMealIntakeLogsOnDate(userId, date);
    return addMacros(fromPlan, fromLogs);
  }

  private async sumMealIntakeLogsOnDate(
    userId: string,
    date: string,
  ): Promise<MacroNutrition> {
    const logs = await this.prisma.mealIntakeLog.findMany({
      where: { userId, date },
      select: { nutrition: true },
    });
    let total = emptyMacros();
    for (const log of logs) {
      const n = log.nutrition as MacroNutrition;
      if (n && typeof n.calories === 'number') {
        total = addMacros(total, n);
      }
    }
    return total;
  }

  private async countEatenOnDate(
    userId: string,
    date: string,
  ): Promise<number> {
    const { start, end } = this.dayBoundsUtc(date);
    return this.prisma.plannedMeal.count({
      where: {
        eatenAt: { gte: start, lte: end },
        version: { isActive: true, mealPlan: { userId } },
      },
    });
  }

  private async sumEatenInRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<MacroNutrition> {
    const { start } = this.dayBoundsUtc(startDate);
    const { end } = this.dayBoundsUtc(endDate);
    const meals = await this.prisma.plannedMeal.findMany({
      where: {
        eatenAt: { gte: start, lte: end },
        version: { isActive: true, mealPlan: { userId } },
      },
      select: { nutrition: true },
    });
    const fromPlan = sumMealNutrition(meals);
    const logs = await this.prisma.mealIntakeLog.findMany({
      where: { userId, date: { gte: startDate, lte: endDate } },
      select: { nutrition: true },
    });
    let fromLogs = emptyMacros();
    for (const log of logs) {
      const n = log.nutrition as MacroNutrition;
      if (n?.calories != null) fromLogs = addMacros(fromLogs, n);
    }
    return addMacros(fromPlan, fromLogs);
  }

  private async eatenByDateInRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<Map<string, MacroNutrition>> {
    const { start } = this.dayBoundsUtc(startDate);
    const { end } = this.dayBoundsUtc(endDate);
    const meals = await this.prisma.plannedMeal.findMany({
      where: {
        eatenAt: { gte: start, lte: end },
        version: { isActive: true, mealPlan: { userId } },
      },
      select: { eatenAt: true, nutrition: true },
    });
    const map = new Map<string, MacroNutrition>();
    for (const meal of meals) {
      if (!meal.eatenAt) continue;
      const date = meal.eatenAt.toISOString().slice(0, 10);
      const prev = map.get(date) ?? emptyMacros();
      map.set(date, addMealMacro(prev, meal.nutrition));
    }
    const logs = await this.prisma.mealIntakeLog.findMany({
      where: { userId, date: { gte: startDate, lte: endDate } },
      select: { date: true, nutrition: true },
    });
    for (const log of logs) {
      const prev = map.get(log.date) ?? emptyMacros();
      map.set(log.date, addMacros(prev, log.nutrition as MacroNutrition));
    }
    return map;
  }

  private async plannedMealsForCalendarDate(
    userId: string,
    date: string,
  ): Promise<Array<{ nutrition: unknown }>> {
    const versions = await this.prisma.mealPlanVersion.findMany({
      where: { isActive: true, mealPlan: { userId } },
      include: { meals: true, mealPlan: { select: { startDate: true } } },
    });
    const rows: Array<{ nutrition: unknown }> = [];
    for (const version of versions) {
      for (const meal of version.meals) {
        if (
          this.calendarDateForMeal(
            version.mealPlan.startDate,
            meal.dayIndex,
          ) === date
        ) {
          rows.push(meal);
        }
      }
    }
    return rows;
  }

  private calendarDateForMeal(startDate: string, dayIndex: number): string {
    const d = new Date(`${startDate}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + dayIndex);
    return d.toISOString().slice(0, 10);
  }

  private calculateDeficitStreak(days: Array<{ deficit: number }>): number {
    let best = 0;
    let current = 0;
    for (const day of days) {
      if (day.deficit > 0) {
        current += 1;
        best = Math.max(best, current);
      } else {
        current = 0;
      }
    }
    return best;
  }

  private balanceLabel(actual: number, target: number): string {
    if (!target) return 'insufficient data';
    const pct = (actual / target) * 100;
    if (pct < 85) return 'below target';
    if (pct > 115) return 'above target';
    return 'on target';
  }
}

function sumMealNutrition(
  meals: Array<{ nutrition: unknown }>,
): MacroNutrition {
  let total = emptyMacros();
  for (const meal of meals) {
    total = addMealMacro(total, meal.nutrition);
  }
  return total;
}

function addMealMacro(acc: MacroNutrition, raw: unknown): MacroNutrition {
  const n = raw as MacroNutrition;
  return {
    calories: acc.calories + Math.round(n?.calories ?? 0),
    protein: round1(acc.protein + (n?.protein ?? 0)),
    carbs: round1(acc.carbs + (n?.carbs ?? 0)),
    fats: round1(acc.fats + (n?.fats ?? 0)),
  };
}

function pct(actual: number, target: number): number {
  if (!target) return 0;
  return Math.round((actual / target) * 1000) / 10;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
