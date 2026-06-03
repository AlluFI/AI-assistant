import { hasWellnessInputs } from './analytics-wellness.util';
import type { HealthProfileLike } from './analytics-wellness.util';

const emptyProfile: HealthProfileLike = {
  heightCm: null,
  weightKg: null,
  targetWeightKg: null,
  activityLevel: null,
  fitnessGoalPrimary: null,
  weeklyActivityDays: null,
};

describe('hasWellnessInputs', () => {
  it('returns false for empty profile and snapshot', () => {
    expect(
      hasWellnessInputs(emptyProfile, {
        weightKg: null,
        heightCm: null,
        weeklyActivityDays: null,
      }),
    ).toBe(false);
  });

  it('returns true when height and weight are set', () => {
    expect(
      hasWellnessInputs(
        { ...emptyProfile, weightKg: 70 as never, heightCm: 175 as never },
        { weightKg: 70, heightCm: 175, weeklyActivityDays: null },
      ),
    ).toBe(true);
  });

  it('returns true when activity level is set', () => {
    expect(
      hasWellnessInputs(
        { ...emptyProfile, activityLevel: 'moderate' },
        { weightKg: null, heightCm: null, weeklyActivityDays: null },
      ),
    ).toBe(true);
  });

  it('returns true when weekly activity days are set', () => {
    expect(
      hasWellnessInputs(emptyProfile, {
        weightKg: null,
        heightCm: null,
        weeklyActivityDays: 3,
      }),
    ).toBe(true);
  });

  it('returns true when weight and target weight are set', () => {
    expect(
      hasWellnessInputs(
        {
          ...emptyProfile,
          weightKg: 80 as never,
          targetWeightKg: 75 as never,
        },
        { weightKg: 80, heightCm: null, weeklyActivityDays: null },
      ),
    ).toBe(true);
  });
});
