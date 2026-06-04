import { validateAiTargetRecommendation } from './nutrition-target-recommendation.util';

describe('validateAiTargetRecommendation', () => {
  it('accepts balanced macros within calorie tolerance', () => {
    const result = validateAiTargetRecommendation({
      calories: 2500,
      macros: { protein: 188, carbs: 281, fats: 69 },
      rationale: 'High protein for muscle gain.',
    });
    expect(result).toEqual({
      calories: 2500,
      macros: { protein: 188, carbs: 281, fats: 69 },
      rationale: 'High protein for muscle gain.',
    });
  });

  it('rejects calories out of range', () => {
    expect(
      validateAiTargetRecommendation({
        calories: 900,
        macros: { protein: 80, carbs: 100, fats: 30 },
      }),
    ).toBeNull();
  });

  it('rejects macros that do not sum to calories', () => {
    expect(
      validateAiTargetRecommendation({
        calories: 2000,
        macros: { protein: 50, carbs: 50, fats: 10 },
      }),
    ).toBeNull();
  });
});
