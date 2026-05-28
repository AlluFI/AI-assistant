/** Standard units per project spec: g, ml, kcal, minutes. */

export type MacroNutrition = {
  calories: number;
  carbs: number;
  protein: number;
  fats: number;
};

export type IngredientLine = {
  id?: string;
  name: string;
  quantity: number;
  unit?: 'gram' | 'milliliter';
};

export function emptyMacros(): MacroNutrition {
  return { calories: 0, carbs: 0, protein: 0, fats: 0 };
}

export function addMacros(
  a: MacroNutrition,
  b: MacroNutrition,
): MacroNutrition {
  return {
    calories: Math.round(a.calories + b.calories),
    carbs: round1(a.carbs + b.carbs),
    protein: round1(a.protein + b.protein),
    fats: round1(a.fats + b.fats),
  };
}

export function scaleMacros(m: MacroNutrition, factor: number): MacroNutrition {
  return {
    calories: Math.round(m.calories * factor),
    carbs: round1(m.carbs * factor),
    protein: round1(m.protein * factor),
    fats: round1(m.fats * factor),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
