import { planCoversDate } from './meal-plan-date.util';

export type MealPlanCoveringCandidate = {
  id: string;
  startDate: string;
  duration: string;
  updatedAt: Date;
  versions: Array<{ isActive: boolean; versionNumber?: number }>;
};

/**
 * Pick the meal plan that should drive "today" for a calendar date.
 *
 * Only one version is globally `isActive` after generate/reapply. A newer daily plan
 * may hold that flag while a weekly plan still covers today — prefer a covering plan
 * with the active version, otherwise the best covering plan (weekly, then recent).
 */
export function pickMealPlanForDate<T extends MealPlanCoveringCandidate>(
  plans: T[],
  date: string,
  isHiddenPlanId: (id: string) => boolean = () => false,
): T | null {
  const covering = plans.filter(
    (plan) =>
      !isHiddenPlanId(plan.id) &&
      plan.versions.length > 0 &&
      planCoversDate(plan.startDate, plan.duration, date),
  );
  if (!covering.length) return null;

  const withActiveVersion = covering.filter((plan) =>
    plan.versions.some((v) => v.isActive),
  );
  const pool = withActiveVersion.length > 0 ? withActiveVersion : covering;

  return [...pool].sort((a, b) => {
    const activeA = a.versions.some((v) => v.isActive) ? 1 : 0;
    const activeB = b.versions.some((v) => v.isActive) ? 1 : 0;
    if (activeB !== activeA) return activeB - activeA;

    const weeklyA = a.duration === 'weekly' ? 1 : 0;
    const weeklyB = b.duration === 'weekly' ? 1 : 0;
    if (weeklyB !== weeklyA) return weeklyB - weeklyA;

    return b.updatedAt.getTime() - a.updatedAt.getTime();
  })[0];
}
