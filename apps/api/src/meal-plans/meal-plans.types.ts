import type { MacroNutrition } from '../shared/units';

export type GenerationStep = {
  step: number;
  name: string;
  prompt: string;
  response: unknown;
};

export type MealSlot = {
  dayIndex: number;
  mealType: string;
  scheduledAt: string;
  title: string;
  recipeId?: string;
};

export type MealPlanPreferences = Record<string, unknown>;

export type PlannedMealNutritionRow = {
  dayIndex: number;
  nutrition: MacroNutrition;
};
