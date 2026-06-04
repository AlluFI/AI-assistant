import {
  healthBasicsMissing,
  parseHealthBasicsFromText,
} from './onboarding-health-parse.util';

describe('onboarding-health-parse.util', () => {
  it('parses a bundled health message', () => {
    const p = parseHealthBasicsFromText(
      "I'm 32, female, 168 cm, 72 kg, moderately active, goal is weight loss",
    );
    expect(p).toMatchObject({
      age: 32,
      gender: 'female',
      heightCm: 168,
      weightKg: 72,
      activityLevel: 'moderate',
      fitnessGoalPrimary: 'weight_loss',
    });
  });

  it('lists missing fields', () => {
    expect(healthBasicsMissing({ age: 30 }, {})).toContain('height (cm)');
    expect(healthBasicsMissing({ age: 30, heightCm: 180, weightKg: 80, activityLevel: 'light', fitnessGoalPrimary: 'maintenance' }, {})).toEqual([]);
  });
});
