import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { weeklyActiveDaysFromLogs } from '../analytics/activity-week.util';
import { NutritionAnalyticsService } from '../nutrition-analytics/nutrition-analytics.service';
import { isHiddenDemoMealPlanId } from '../shared/demo-meal-plan.util';
import { NutritionService } from '../nutrition/nutrition.service';
import { dayIndexForPlanDate } from '../shared/meal-plan-date.util';
import { pickMealPlanForDate } from '../shared/meal-plan-resolve.util';
import type { MacroNutrition } from '../shared/units';
import {
  computeAdherence,
  computeStreaks,
} from './adherence.util';
import { DailyCheckInService } from './daily-check-in.service';
import { dayCheckInScore } from '../analytics/check-in-wellness.util';

@Injectable()
export class TodayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nutritionAnalytics: NutritionAnalyticsService,
    private readonly analytics: AnalyticsService,
    private readonly checkIns: DailyCheckInService,
    private readonly nutrition: NutritionService,
  ) {}

  async getSummary(userId: string, date?: string) {
    const today = date ?? new Date().toISOString().slice(0, 10);

    const [
      nutrition,
      checkIn,
      nextMeal,
      reminders,
      activityWeek,
      adherence,
      streaks,
      summary,
    ] = await Promise.all([
      this.nutritionAnalytics.dailySummary(userId, today),
      this.checkIns.getForDate(userId, today),
      this.resolveNextMeal(userId, today),
      this.resolveReminders(userId),
      this.activityThisWeek(userId),
      this.buildAdherence(userId),
      this.buildStreaks(userId),
      this.analytics.getSummary(userId),
    ]);

    const caloriesRemaining = Math.max(
      0,
      nutrition.target.calories - nutrition.intake.calories,
    );

    const checkInDayScore = checkIn
      ? dayCheckInScore({
          sleepHours: checkIn.sleepHours,
          waterGlasses: checkIn.waterGlasses,
          mood: checkIn.mood,
        })
      : null;
    const checkInWeekScore = summary.checkInWeekScore ?? null;

    return {
      date: today,
      nutrition: {
        ...nutrition,
        caloriesRemaining,
      },
      checkIn,
      checkInDayScore,
      checkInWeekScore,
      nextMeal,
      reminders,
      activityWeek,
      adherence,
      streaks,
      wellnessScore: summary.wellnessScore,
    };
  }

  private async resolveNextMeal(userId: string, today: string) {
    const plans = await this.prisma.mealPlan.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        versions: {
          orderBy: [{ isActive: 'desc' }, { versionNumber: 'desc' }],
          take: 1,
          include: {
            meals: {
              orderBy: [{ sortOrder: 'asc' }],
              include: {
                recipe: { select: { title: true, timeMinutes: true } },
              },
            },
          },
        },
      },
    });

    const plan = pickMealPlanForDate(plans, today, isHiddenDemoMealPlanId);
    if (!plan?.versions[0]) return null;

    const dayIndex = dayIndexForPlanDate(
      plan.startDate,
      today,
      plan.duration,
    );
    const now = Date.now();
    const dayMeals = plan.versions[0].meals
      .filter((m) => m.dayIndex === dayIndex)
      .map((m) => {
        const nutrition = m.nutrition as MacroNutrition | null;
        return {
          id: m.id,
          mealType: m.mealType,
          title: m.title,
          scheduledAt: m.scheduledAt.toISOString(),
          eaten: Boolean(m.eatenAt),
          calories: nutrition?.calories ?? null,
          recipeTitle: m.recipe?.title ?? null,
        };
      });

    const upcoming = dayMeals
      .filter((m) => !m.eaten)
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() -
          new Date(b.scheduledAt).getTime(),
      );

    const next =
      upcoming.find((m) => new Date(m.scheduledAt).getTime() >= now) ??
      upcoming[0] ??
      null;

    return {
      planId: plan.id,
      dayIndex,
      mealsToday: dayMeals.length,
      mealsEatenToday: dayMeals.filter((m) => m.eaten).length,
      next,
    };
  }

  private async resolveReminders(userId: string) {
    const [metric, activity, privacy] = await Promise.all([
      this.prisma.healthMetricSnapshot.findFirst({
        where: { userId },
        orderBy: { recordedAt: 'desc' },
      }),
      this.prisma.activityLog.findFirst({
        where: { userId },
        orderBy: { activityAt: 'desc' },
      }),
      this.prisma.privacySettings.findUnique({ where: { userId } }),
    ]);

    const weightAt = metric?.recordedAt?.getTime() ?? null;
    const activityAt = activity?.activityAt?.getTime() ?? null;
    const weightMs = 7 * 24 * 60 * 60 * 1000;
    const activityCadence = privacy?.activityReminderCadence ?? 'daily';
    const activityMs =
      activityCadence === 'weekly'
        ? 7 * 24 * 60 * 60 * 1000
        : 24 * 60 * 60 * 1000;

    return {
      weightDue:
        (privacy?.weightReminderEnabled ?? true) &&
        (!weightAt || Date.now() - weightAt >= weightMs),
      activityDue:
        activityCadence !== 'off' &&
        (!activityAt || Date.now() - activityAt >= activityMs),
    };
  }

  private async activityThisWeek(userId: string) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 7);
    const logs = await this.prisma.activityLog.findMany({
      where: { userId, activityAt: { gte: since } },
      select: { activityAt: true },
    });
    const series = weeklyActiveDaysFromLogs(logs);
    const latest = series[series.length - 1];
    const profile = await this.prisma.healthProfile.findUnique({
      where: { userId },
      select: { weeklyActivityDays: true, desiredActivityLevel: true },
    });
    const target = profile?.weeklyActivityDays ?? null;

    return {
      activeDaysThisWeek: latest?.weeklyActivityDays ?? 0,
      targetDays: target,
    };
  }

  private async buildAdherence(userId: string) {
    return computeAdherence(
      this.prisma,
      userId,
      7,
      (uid, date) => this.nutritionAnalytics.dailySummary(uid, date).then((d) => d.mealsPlanned ?? 0),
      (uid, date) => this.nutritionAnalytics.dailySummary(uid, date).then((d) => d.mealsEaten ?? 0),
      (uid, date) =>
        this.prisma.mealIntakeLog.count({ where: { userId: uid, date } }),
    );
  }

  private async buildStreaks(userId: string) {
    const combined = await this.nutrition.getCombinedProfile(userId);
    const target =
      combined.nutritionProfile?.macroTargets as MacroNutrition | null;
    const protein =
      target?.protein ?? combined.suggestedTargets?.macros?.protein ?? 100;

    return computeStreaks(
      this.prisma,
      userId,
      protein,
      (uid, date) => this.sumIntake(uid, date),
      async (uid, date) => {
        const intake = await this.sumIntake(uid, date);
        if (intake.calories > 0) return true;
        const logs = await this.prisma.mealIntakeLog.count({
          where: { userId: uid, date },
        });
        return logs > 0;
      },
    );
  }

  private async sumIntake(userId: string, date: string): Promise<MacroNutrition> {
    const daily = await this.nutritionAnalytics.dailySummary(userId, date);
    return daily.intake;
  }
}
