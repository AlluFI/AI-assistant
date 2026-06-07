/** Resolve date + meal slot for planned-meal prep or nutrition questions. */

export type PlannedMealSlot = {
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
};

const PREP_PATTERN =
  /how (?:do i|to) prepare|how (?:do i|to) cook|prepare|cook tonight|make tonight|prepare tomorrow|make tomorrow|tonight'?s (?:dinner|meal)|tomorrow'?s (?:dinner|meal)|recipe steps|preparation steps/i;

const NUTRIENTS_PATTERN =
  /nutrient|macro|calorie|protein|carb|fat|what'?s in|what is in|how much.*(protein|calorie)|breakdown of|nutrition in/i;

function utcDateOffsetDays(days: number): string {
  const target = new Date();
  target.setUTCHours(12, 0, 0, 0);
  target.setUTCDate(target.getUTCDate() + days);
  return target.toISOString().slice(0, 10);
}

function parseMealType(
  lower: string,
): PlannedMealSlot['meal_type'] | null {
  if (/\bbreakfast\b/.test(lower)) return 'breakfast';
  if (/\blunch\b/.test(lower)) return 'lunch';
  if (/\bdinner\b|\bsupper\b/.test(lower)) return 'dinner';
  if (/\bsnack\b/.test(lower)) return 'snack';
  return null;
}

export function isPlannedMealNutrientsQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  return NUTRIENTS_PATTERN.test(lower) && parseMealType(lower) != null;
}

/** Alias for prep-focused callers; also covers nutrition questions. */
export function inferMealRecipeToolCall(
  message: string,
): PlannedMealSlot | null {
  return inferPlannedMealSlotToolCall(message);
}

export function inferPlannedMealSlotToolCall(
  message: string,
): PlannedMealSlot | null {
  const lower = message.toLowerCase();
  const isPrep = PREP_PATTERN.test(lower);
  const isNutrients = isPlannedMealNutrientsQuestion(message);
  if (!isPrep && !isNutrients) return null;

  const meal_type = parseMealType(lower);
  if (!meal_type) {
    if (isPrep) {
      return { date: utcDateOffsetDays(/\btomorrow\b/.test(lower) ? 1 : 0), meal_type: 'dinner' };
    }
    return null;
  }

  let date = utcDateOffsetDays(0);
  if (/\btomorrow\b/.test(lower)) date = utcDateOffsetDays(1);
  else if (/\byesterday\b/.test(lower)) date = utcDateOffsetDays(-1);

  return { date, meal_type };
}

export function normalizeRecipeToolArgs(
  userMessage: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...args };
  const inferred = inferPlannedMealSlotToolCall(userMessage);
  if (inferred) {
    if (out.date == null || out.date === '') out.date = inferred.date;
    if (out.meal_type == null || out.meal_type === '') {
      out.meal_type = inferred.meal_type;
    }
  }
  if (out.meal_type && (out.date == null || out.date === '')) {
    out.date = utcDateOffsetDays(0);
  }
  return out;
}
