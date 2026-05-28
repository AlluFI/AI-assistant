import { Injectable } from '@nestjs/common';
import { AnalyticsService, num } from '../analytics/analytics.service';
import type { HealthProfile } from '@prisma/client';

@Injectable()
export class CalorieTargetService {
  constructor(private readonly analytics: AnalyticsService) {}

  /** Mifflin-St Jeor BMR with activity multiplier; adjusted for weight goal. */
  computeFromProfile(profile: HealthProfile | null): {
    calories: number;
    macros: { protein: number; carbs: number; fats: number };
    source: 'computed';
  } | null {
    if (!profile) return null;
    const weight = num(profile.weightKg);
    const height = num(profile.heightCm);
    const age = profile.age;
    if (weight == null || height == null || age == null) return null;

    const gender = (profile.gender ?? '').toLowerCase();
    const bmr =
      10 * weight + 6.25 * height - 5 * age + (gender === 'male' ? 5 : -161);

    const activityMult: Record<string, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9,
    };
    const level = (profile.activityLevel ?? 'moderate').toLowerCase();
    let tdee = bmr * (activityMult[level] ?? 1.55);

    const goal = (profile.fitnessGoalPrimary ?? '').toLowerCase();
    if (goal.includes('loss')) tdee -= 400;
    else if (goal.includes('gain') || goal.includes('muscle')) tdee += 300;

    const calories = Math.max(1200, Math.round(tdee));
    const protein = Math.round((calories * 0.3) / 4);
    const fats = Math.round((calories * 0.25) / 9);
    const carbs = Math.round((calories - protein * 4 - fats * 9) / 4);

    return {
      calories,
      macros: { protein, carbs, fats },
      source: 'computed',
    };
  }
}
