/** Meal plans with this id prefix back demo nutrition analytics only; hidden from list/detail UI. */
export const DEMO_INTAKE_MEAL_PLAN_PREFIX = 'demo_intake_';

export function isHiddenDemoMealPlanId(id: string): boolean {
  return id.startsWith(DEMO_INTAKE_MEAL_PLAN_PREFIX);
}
