import {
  computeMealPlanEnhancedAnalytics,
  deriveRecipeEnhancedNutrition,
} from './enhanced-nutrition.util';

describe('enhanced-nutrition.util', () => {
  describe('deriveRecipeEnhancedNutrition', () => {
    const baseRecipe = {
      id: 'recipe-test-1',
      meal: 'lunch',
      dietaryTags: [] as string[],
      timeMinutes: 30,
      difficultyLevel: 'easy',
    };

    it('returns deterministic values for the same recipe id', () => {
      const a = deriveRecipeEnhancedNutrition(baseRecipe, {
        calories: 500,
        protein: 30,
        carbs: 40,
        fats: 15,
      });
      const b = deriveRecipeEnhancedNutrition(baseRecipe, {
        calories: 500,
        protein: 30,
        carbs: 40,
        fats: 15,
      });
      expect(a.glycemic_index).toBe(b.glycemic_index);
      expect(a.nutrient_density_score).toBe(b.nutrient_density_score);
    });

    it('lowers glycemic index for low-carb tagged recipes', () => {
      const lowCarb = deriveRecipeEnhancedNutrition(
        { ...baseRecipe, id: 'recipe-low-carb', dietaryTags: ['low-carb'] },
        { calories: 400, protein: 25, carbs: 10, fats: 20 },
      );
      const standard = deriveRecipeEnhancedNutrition(
        { ...baseRecipe, id: 'recipe-standard' },
        { calories: 400, protein: 25, carbs: 10, fats: 20 },
      );
      expect(lowCarb.glycemic_index).toBeLessThanOrEqual(45);
      expect(standard.glycemic_index).toBeGreaterThanOrEqual(15);
    });

    it('includes antioxidant profile and processing level', () => {
      const enhanced = deriveRecipeEnhancedNutrition(baseRecipe);
      expect(enhanced.antioxidant_profile).toBeDefined();
      expect(enhanced.processing_level).toBeTruthy();
      expect(enhanced.satiety_index).toBeGreaterThan(0);
    });
  });

  describe('computeMealPlanEnhancedAnalytics', () => {
    it('aggregates multi-day meals into analytics', () => {
      const analytics = computeMealPlanEnhancedAnalytics(
        [
          {
            dayIndex: 0,
            title: 'Oats',
            mealType: 'breakfast',
            nutrition: { calories: 400, protein: 12, carbs: 60, fats: 8 },
            recipe: { cuisine: 'American' },
          },
          {
            dayIndex: 1,
            title: 'Salad',
            mealType: 'lunch',
            nutrition: { calories: 500, protein: 20, carbs: 40, fats: 18 },
            recipe: { cuisine: 'Mediterranean' },
          },
        ],
        {
          calories: 2000,
          macros: { calories: 2000, protein: 120, carbs: 200, fats: 70 },
        },
      );
      expect(analytics.nutritional_balance_score).toBeGreaterThan(0);
      expect(analytics.diversity_index).toBeGreaterThan(0);
      expect(analytics.micronutrient_coverage).toBeDefined();
    });
  });
});
