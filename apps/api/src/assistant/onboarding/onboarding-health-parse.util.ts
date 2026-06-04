export type ParsedHealthBasics = {
  age?: number;
  gender?: string;
  heightCm?: number;
  weightKg?: number;
  activityLevel?: string;
  fitnessGoalPrimary?: string;
};

const GENDERS = new Set([
  'female',
  'male',
  'non_binary',
  'prefer_not_say',
  'other',
]);

const ACTIVITY = new Set([
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
]);

const GOALS = new Set([
  'weight_loss',
  'muscle_gain',
  'general_fitness',
  'maintenance',
]);

const GOAL_ALIASES: Record<string, string> = {
  loss: 'weight_loss',
  'weight loss': 'weight_loss',
  'lose weight': 'weight_loss',
  cut: 'weight_loss',
  muscle: 'muscle_gain',
  'muscle gain': 'muscle_gain',
  bulk: 'muscle_gain',
  gain: 'muscle_gain',
  maintain: 'maintenance',
  maintenance: 'maintenance',
  fitness: 'general_fitness',
  'general fitness': 'general_fitness',
};

const ACTIVITY_ALIASES: Record<string, string> = {
  sedentary: 'sedentary',
  desk: 'sedentary',
  office: 'sedentary',
  light: 'light',
  'lightly active': 'light',
  moderate: 'moderate',
  'moderately active': 'moderate',
  'very active': 'very_active',
  athlete: 'very_active',
  active: 'active',
};

/** Extract health profile fields from a free-text wingman reply. */
export function parseHealthBasicsFromText(text: string): ParsedHealthBasics {
  const lower = text.toLowerCase();
  const out: ParsedHealthBasics = {};

  const ageMatch =
    text.match(/\b(?:age|i'?m|i am)\s*(\d{1,3})\b/i) ??
    text.match(/\b(\d{1,2})\s*(?:years?\s*old|yo)\b/i);
  if (ageMatch) {
    const age = Number(ageMatch[1]);
    if (age >= 10 && age <= 120) out.age = age;
  }

  const heightCm =
    text.match(/\b(\d{2,3})\s*cm\b/i) ??
    text.match(/\bheight\s*(\d{2,3})\b/i);
  if (heightCm) {
    const h = Number(heightCm[1]);
    if (h >= 50 && h <= 260) out.heightCm = h;
  }

  const weightKg =
    text.match(/\b(\d{2,3}(?:[.,]\d+)?)\s*kg\b/i) ??
    text.match(/\bweight\s*(\d{2,3}(?:[.,]\d+)?)\b/i);
  if (weightKg) {
    const w = parseFloat(weightKg[1].replace(',', '.'));
    if (w >= 20 && w <= 400) out.weightKg = w;
  }

  if (/\bfemale\b|\bwoman\b/i.test(lower)) out.gender = 'female';
  else if (/\bmale\b|\bman\b/i.test(lower)) out.gender = 'male';
  else if (/\bnon[- ]?binary\b/i.test(lower)) out.gender = 'non_binary';
  else if (/\bprefer not\b/i.test(lower)) out.gender = 'prefer_not_say';

  const activityPhrases = Object.entries(ACTIVITY_ALIASES).sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [phrase, level] of activityPhrases) {
    if (new RegExp(`\\b${phrase.replace(/\s+/g, '\\s+')}\\b`, 'i').test(lower)) {
      out.activityLevel = level;
      break;
    }
  }

  for (const [phrase, goal] of Object.entries(GOAL_ALIASES)) {
    if (new RegExp(`\\b${phrase.replace(/\s+/g, '\\s+')}\\b`, 'i').test(lower)) {
      out.fitnessGoalPrimary = goal;
      break;
    }
  }

  if (out.gender && !GENDERS.has(out.gender)) delete out.gender;
  if (out.activityLevel && !ACTIVITY.has(out.activityLevel)) {
    delete out.activityLevel;
  }
  if (out.fitnessGoalPrimary && !GOALS.has(out.fitnessGoalPrimary)) {
    delete out.fitnessGoalPrimary;
  }

  return out;
}

export function healthBasicsMissing(
  parsed: ParsedHealthBasics,
  existing: {
    age?: number | null;
    heightCm?: number | null;
    weightKg?: number | null;
    activityLevel?: string | null;
    fitnessGoalPrimary?: string | null;
  },
): string[] {
  const missing: string[] = [];
  const age = parsed.age ?? existing.age;
  const heightCm = parsed.heightCm ?? existing.heightCm;
  const weightKg = parsed.weightKg ?? existing.weightKg;
  const activityLevel = parsed.activityLevel ?? existing.activityLevel;
  const fitnessGoalPrimary =
    parsed.fitnessGoalPrimary ?? existing.fitnessGoalPrimary;

  if (age == null) missing.push('age');
  if (heightCm == null) missing.push('height (cm)');
  if (weightKg == null) missing.push('weight (kg)');
  if (!activityLevel) {
    missing.push('activity level (sedentary / light / moderate / active / very_active)');
  }
  if (!fitnessGoalPrimary) {
    missing.push('goal (weight_loss / muscle_gain / maintenance / general_fitness)');
  }
  return missing;
}
