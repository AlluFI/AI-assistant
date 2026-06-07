import {
  balanceDayNutrition,
  dailyCalorieTarget,
  evaluateDayAgainstTargets,
  fitNutritionToTarget,
  normalizeNutrition,
  scaleMealsToDailyTarget,
  slotCalorieBudget,
} from './meal-plan-nutrition.util';
import type { MealPlanPreferences } from './meal-plans.types';

describe('meal-plan-nutrition.util', () => {
  describe('dailyCalorieTarget', () => {
    it('uses calorie_target when valid', () => {
      expect(
        dailyCalorieTarget({ calorie_target: 1800 } as MealPlanPreferences),
      ).toBe(1800);
    });

    it('defaults to 2000 when missing or invalid', () => {
      expect(dailyCalorieTarget({} as MealPlanPreferences)).toBe(2000);
      expect(
        dailyCalorieTarget({ calorie_target: -1 } as MealPlanPreferences),
      ).toBe(2000);
    });
  });

  describe('slotCalorieBudget', () => {
    it('allocates snack calories separately', () => {
      const prefs = {
        calorie_target: 2000,
        meals_per_day: 3,
        snacks_per_day: 2,
      } as MealPlanPreferences;
      const snack = slotCalorieBudget(prefs, 'snack');
      const lunch = slotCalorieBudget(prefs, 'lunch');
      expect(snack).toBeGreaterThan(0);
      expect(lunch).toBeGreaterThan(snack);
    });
  });

  describe('normalizeNutrition', () => {
    it('rounds calories and clamps negatives', () => {
      expect(normalizeNutrition({ calories: 401.7, protein: -2 })).toEqual({
        calories: 402,
        protein: 0,
        carbs: 0,
        fats: 0,
      });
    });
  });

  describe('scaleMealsToDailyTarget', () => {
    it('scales meal calories toward the daily target', () => {
      const meals = [
        { nutrition: { calories: 500, protein: 20, carbs: 50, fats: 10 } },
        { nutrition: { calories: 500, protein: 20, carbs: 50, fats: 10 } },
      ];
      scaleMealsToDailyTarget(meals, 2000);
      const total = meals.reduce((s, m) => s + m.nutrition.calories, 0);
      expect(total).toBeGreaterThanOrEqual(1990);
      expect(total).toBeLessThanOrEqual(2010);
    });

    it('no-ops when already within 2% of target', () => {
      const meals = [
        { nutrition: { calories: 1000, protein: 10, carbs: 10, fats: 10 } },
      ];
      const before = { ...meals[0].nutrition };
      scaleMealsToDailyTarget(meals, 1000);
      expect(meals[0].nutrition).toEqual(before);
    });
  });

  describe('balanceDayNutrition', () => {
    it('balances each day independently', () => {
      const meals = [
        {
          dayIndex: 0,
          nutrition: { calories: 300, protein: 10, carbs: 30, fats: 5 },
        },
        {
          dayIndex: 0,
          nutrition: { calories: 300, protein: 10, carbs: 30, fats: 5 },
        },
        {
          dayIndex: 1,
          nutrition: { calories: 800, protein: 20, carbs: 80, fats: 15 },
        },
      ];
      balanceDayNutrition(meals, {
        calorie_target: 1200,
      } as MealPlanPreferences);
      const day0 = meals
        .filter((m) => m.dayIndex === 0)
        .reduce((s, m) => s + m.nutrition.calories, 0);
      expect(day0).toBeGreaterThanOrEqual(1190);
      expect(day0).toBeLessThanOrEqual(1210);
    });
  });

  describe('fitNutritionToTarget', () => {
    it('scales per-serving macros toward target calories', () => {
      const scaled = fitNutritionToTarget(
        { calories: 400, protein: 20, carbs: 40, fats: 10 },
        600,
      );
      expect(scaled.calories).toBeGreaterThan(400);
      expect(scaled.calories).toBeLessThanOrEqual(1000);
    });
  });

  describe('evaluateDayAgainstTargets', () => {
    it('warns when calories exceed target by more than threshold', () => {
      const result = evaluateDayAgainstTargets(
        { calories: 2400, protein: 120, carbs: 200, fats: 80 },
        { calorie_target: 2000 } as MealPlanPreferences,
        { protein: 150, carbs: 200, fats: 65 },
      );
      expect(result.needsReplanWarning).toBe(true);
      expect(result.calorieDirection).toBe('over');
    });

    it('does not warn when within calorie tolerance', () => {
      const result = evaluateDayAgainstTargets(
        { calories: 1980, protein: 140, carbs: 190, fats: 60 },
        { calorie_target: 2000 } as MealPlanPreferences,
        { protein: 150, carbs: 200, fats: 65 },
      );
      expect(result.needsReplanWarning).toBe(false);
      expect(result.calorieDirection).toBe('ok');
    });
  });
});
