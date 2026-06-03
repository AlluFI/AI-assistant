import { Prisma } from '@prisma/client';

export type HealthProfileLike = {
  heightCm: Prisma.Decimal | null;
  weightKg: Prisma.Decimal | null;
  targetWeightKg: Prisma.Decimal | null;
  activityLevel: string | null;
  fitnessGoalPrimary: string | null;
  weeklyActivityDays: number | null;
};

function num(
  v: Prisma.Decimal | number | null | undefined,
): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  return v.toNumber();
}

const ACTIVITY_LEVELS = new Set([
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
]);

export type WellnessSnapshot = {
  weightKg: number | null;
  heightCm: number | null;
  weeklyActivityDays: number | null;
};

/** True when at least one wellness component can use real user data (not placeholders). */
export function hasWellnessInputs(
  profile: HealthProfileLike,
  snapshot: WellnessSnapshot,
): boolean {
  const w = snapshot.weightKg ?? num(profile.weightKg);
  const h = snapshot.heightCm ?? num(profile.heightCm);
  if (w != null && h != null && w > 0 && h > 0) return true;

  const level = (profile.activityLevel ?? '').toLowerCase();
  if (ACTIVITY_LEVELS.has(level)) return true;

  const weekly =
    snapshot.weeklyActivityDays ?? profile.weeklyActivityDays;
  if (weekly != null) return true;

  const target = num(profile.targetWeightKg);
  if (w != null && target != null && w > 0 && target > 0) return true;

  return false;
}
