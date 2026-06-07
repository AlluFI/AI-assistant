import {
  inferMealRecipeToolCall,
  inferPlannedMealSlotToolCall,
  isPlannedMealNutrientsQuestion,
  normalizeRecipeToolArgs,
} from './meal-recipe-infer.util';

describe('inferMealRecipeToolCall', () => {
  function utcTodayPlus(days: number): string {
    const d = new Date();
    d.setUTCHours(12, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  it('detects tomorrow dinner prep', () => {
    const r = inferMealRecipeToolCall(
      "How do I prepare tomorrow night's dinner?",
    );
    expect(r).not.toBeNull();
    expect(r!.meal_type).toBe('dinner');
    expect(r!.date).toBe(utcTodayPlus(1));
  });

  it('detects tonight dinner', () => {
    const r = inferMealRecipeToolCall("How do I prepare tonight's dinner?");
    expect(r?.meal_type).toBe('dinner');
    expect(r?.date).toBe(utcTodayPlus(0));
  });

  it('ignores unrelated questions', () => {
    expect(inferMealRecipeToolCall('What is my BMI?')).toBeNull();
  });

  it('detects breakfast nutrients question', () => {
    expect(isPlannedMealNutrientsQuestion('What nutrients are in my breakfast?')).toBe(
      true,
    );
    const slot = inferPlannedMealSlotToolCall('What nutrients are in my breakfast?');
    expect(slot?.meal_type).toBe('breakfast');
    expect(slot?.date).toBe(utcTodayPlus(0));
  });

  it('does not treat add-to-plan requests as nutrient questions', () => {
    const msg =
      "add a protein shake as a snack for today's meal plan";
    expect(isPlannedMealNutrientsQuestion(msg)).toBe(false);
    expect(inferPlannedMealSlotToolCall(msg)).toBeNull();
  });

  it('normalizes get_recipe args from user message', () => {
    expect(
      normalizeRecipeToolArgs('What nutrients are in my breakfast?', {
        meal_type: 'breakfast',
      }),
    ).toMatchObject({
      meal_type: 'breakfast',
      date: utcTodayPlus(0),
    });
  });
});
