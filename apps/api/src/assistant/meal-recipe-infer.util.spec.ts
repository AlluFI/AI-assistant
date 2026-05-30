import { inferMealRecipeToolCall } from './meal-recipe-infer.util';

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
});
