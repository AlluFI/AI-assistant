import {
  inferMealPlanWeekScope,
  normalizeMealPlanToolArgs,
} from './meal-plan-infer.util';

describe('meal-plan-infer.util', () => {
  it('detects weekly meal plan questions', () => {
    expect(inferMealPlanWeekScope("What's my meal plan for the week?")).toBe(
      true,
    );
    expect(inferMealPlanWeekScope('meal plan today')).toBe(false);
  });

  it('adds scope week to tool args when inferred', () => {
    expect(
      normalizeMealPlanToolArgs("What's my meal plan for the week?", {}),
    ).toEqual({ scope: 'week' });
    expect(normalizeMealPlanToolArgs('lunch today', { date: '2026-05-30' })).toEqual({
      date: '2026-05-30',
    });
  });
});
