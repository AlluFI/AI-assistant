import { MacroNutrition, scaleMacros } from '../shared/units';
import type { MealPlanPreferences } from './meal-plans.types';

export function dailyCalorieTarget(prefs: MealPlanPreferences): number {
  const raw = prefs.calorie_target;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 2000;
}

/** Calories per slot so main meals + snacks sum to the daily target. */
export function slotCalorieBudget(
  prefs: MealPlanPreferences,
  mealType: string,
): number {
  const daily = dailyCalorieTarget(prefs);
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

export function normalizeNutrition(
  nutrition?: Partial<MacroNutrition>,
): MacroNutrition {
  return {
    calories: Math.max(0, Math.round(Number(nutrition?.calories ?? 0))),
    protein: Math.max(0, Number(nutrition?.protein ?? 0)),
    carbs: Math.max(0, Number(nutrition?.carbs ?? 0)),
    fats: Math.max(0, Number(nutrition?.fats ?? 0)),
  };
}

export function scaleMealsToDailyTarget(
  meals: Array<{ nutrition: MacroNutrition }>,
  dailyTarget: number,
): void {
  if (!meals.length) return;
  const total = meals.reduce((sum, m) => sum + (m.nutrition.calories ?? 0), 0);
  if (total <= 0) return;
  const factor = dailyTarget / total;
  if (Math.abs(factor - 1) < 0.02) return;
  for (const meal of meals) {
    meal.nutrition = scaleMacros(meal.nutrition, factor);
  }
}

export function balanceDayNutrition(
  meals: Array<{ dayIndex: number; nutrition: MacroNutrition }>,
  prefs: MealPlanPreferences,
): void {
  const daily = dailyCalorieTarget(prefs);
  const dayIndexes = [...new Set(meals.map((m) => m.dayIndex))];
  for (const dayIndex of dayIndexes) {
    const dayMeals = meals.filter((m) => m.dayIndex === dayIndex);
    scaleMealsToDailyTarget(dayMeals, daily);
  }
}

export function balancePlannedMealRows(
  rows: Array<{ nutrition: MacroNutrition }>,
  prefs: MealPlanPreferences,
): void {
  scaleMealsToDailyTarget(rows, dailyCalorieTarget(prefs));
}

export function fitNutritionToTarget(
  perServing: MacroNutrition,
  targetCalories: number,
): MacroNutrition {
  const base = Math.max(perServing.calories, 1);
  const portion = Math.min(2.5, Math.max(0.2, targetCalories / base));
  return scaleMacros(perServing, portion);
}

export function newMealPlanId(): string {
  return globalThis.crypto?.randomUUID?.()
    ? globalThis.crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
