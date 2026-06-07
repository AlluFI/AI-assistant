import { ACTIVITY_TYPES } from '../profile/activity-catalog';
import { extractCreateRecipeQuery } from './wingman-create-recipe.util';

export type ParsedActivityLog = {
  activityType: string;
  activityTypeLabel: string;
  durationMinutes: number;
  activityAt?: string;
};

export type ParsedWeightLog = {
  weightKg: number;
  recordedAt?: string;
};

const LOG_VERBS = /\b(log|record|add|track|register|save)\b/i;

function normalizeText(text: string) {
  return text.trim().replace(/\s+/g, ' ');
}

function parseDurationMinutes(text: string): number | null {
  const hour = text.match(/(\d+(?:[.,]\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  if (hour) {
    const h = parseFloat(hour[1].replace(',', '.'));
    return Math.min(600, Math.max(1, Math.round(h * 60)));
  }
  const min = text.match(/(\d+)\s*(?:minutes?|mins?|m)\b/i);
  if (min) return Math.min(600, Math.max(1, Number(min[1])));
  const bareHour = text.match(/\b(\d+(?:[.,]\d+)?)\s*hour\b/i);
  if (bareHour) {
    const h = parseFloat(bareHour[1].replace(',', '.'));
    return Math.min(600, Math.max(1, Math.round(h * 60)));
  }
  return null;
}

function parseActivityDate(text: string): string | undefined {
  const lower = text.toLowerCase();
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const isoDay = (d: Date) =>
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  if (/\byesterday\b/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return isoDay(d);
  }
  if (/\btoday\b/.test(lower) || /\bfor today\b/.test(lower)) {
    return isoDay(now);
  }
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return iso?.[1];
}

function matchActivityType(text: string): (typeof ACTIVITY_TYPES)[0] | null {
  const lower = text.toLowerCase();
  for (const a of ACTIVITY_TYPES) {
    if (lower.includes(a.label.toLowerCase())) return a;
    if (lower.includes(a.code.replace(/_/g, ' '))) return a;
    if (lower.includes(a.code)) return a;
  }
  const aliases: Record<string, string> = {
    tenis: 'tennis',
    tennis: 'tennis',
    jog: 'running',
    jogging: 'running',
    run: 'running',
    gym: 'strength',
    weights: 'strength',
    football: 'football',
    soccer: 'football',
    bike: 'cycling',
    biking: 'cycling',
    swim: 'swimming',
  };
  for (const [word, code] of Object.entries(aliases)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(lower)) {
      return ACTIVITY_TYPES.find((a) => a.code === code) ?? null;
    }
  }
  return null;
}

/** Detect "record 1 hour tennis for today" style requests. */
export function parseLogActivityIntent(text: string): ParsedActivityLog | null {
  const normalized = normalizeText(text);
  if (!LOG_VERBS.test(normalized)) return null;

  const activity = matchActivityType(normalized);
  if (!activity) return null;

  const durationMinutes = parseDurationMinutes(normalized);
  if (!durationMinutes) return null;

  const activityAt = parseActivityDate(normalized);
  return {
    activityType: activity.code,
    activityTypeLabel: activity.label,
    durationMinutes,
    activityAt,
  };
}

export function parseLogWeightIntent(text: string): ParsedWeightLog | null {
  const normalized = normalizeText(text);
  if (!LOG_VERBS.test(normalized) && !/\bweigh[- ]?in\b/i.test(normalized)) {
    return null;
  }
  const kg = normalized.match(
    /(\d{2,3}(?:[.,]\d+)?)\s*(?:kg|kilos?|kilograms?)\b/i,
  );
  if (!kg) return null;
  const weightKg = parseFloat(kg[1].replace(',', '.'));
  if (weightKg < 20 || weightKg > 400) return null;
  return {
    weightKg,
    recordedAt: parseActivityDate(normalized),
  };
}

export type ParsedRegenerateMeal = {
  mealType: string;
  mealTypeLabel: string;
};

const MEAL_ALIASES: Record<string, string> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  snack: 'snack',
  tonight: 'dinner',
  "tonight's": 'dinner',
  "today's dinner": 'dinner',
};

/** "Regenerate dinner", "new recipe for tonight", "swap lunch". */
export function parseRegenerateMealIntent(
  text: string,
): ParsedRegenerateMeal | null {
  const lower = text.toLowerCase();
  if (
    !/\b(regenerat(e|ing)?|new recipe|swap|replace|different)\b/i.test(lower) &&
    !/\b(another|change)\s+(meal|dinner|lunch)\b/i.test(lower)
  ) {
    return null;
  }
  for (const [phrase, mealType] of Object.entries(MEAL_ALIASES)) {
    if (lower.includes(phrase)) {
      return {
        mealType,
        mealTypeLabel: mealType.charAt(0).toUpperCase() + mealType.slice(1),
      };
    }
  }
  if (/\bdinner\b/i.test(lower)) {
    return { mealType: 'dinner', mealTypeLabel: 'Dinner' };
  }
  if (/\blunch\b/i.test(lower)) {
    return { mealType: 'lunch', mealTypeLabel: 'Lunch' };
  }
  if (/\bbreakfast\b/i.test(lower)) {
    return { mealType: 'breakfast', mealTypeLabel: 'Breakfast' };
  }
  return { mealType: 'dinner', mealTypeLabel: 'Dinner' };
}

export function parseShoppingListIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /\b(shopping list|grocery list|groceries)\b/i.test(lower) &&
    /\b(create|make|generate|build|open|show|need)\b/i.test(lower)
  );
}

export type ParsedMarkMealEaten = {
  mealType: string;
  mealTypeLabel: string;
};

/** "Mark dinner as eaten", "log lunch as eaten". */
export function parseMarkMealEatenIntent(text: string): ParsedMarkMealEaten | null {
  const lower = text.toLowerCase();
  if (
    !/\b(mark|log).*(eaten|ate|finished|done)\b/i.test(lower) &&
    !/\b(eaten|finished).*(breakfast|lunch|dinner|snack)\b/i.test(lower)
  ) {
    return null;
  }
  for (const [phrase, mealType] of Object.entries(MEAL_ALIASES)) {
    if (lower.includes(phrase)) {
      return {
        mealType,
        mealTypeLabel: mealType.charAt(0).toUpperCase() + mealType.slice(1),
      };
    }
  }
  if (/\bdinner\b/i.test(lower)) {
    return { mealType: 'dinner', mealTypeLabel: 'Dinner' };
  }
  if (/\blunch\b/i.test(lower)) {
    return { mealType: 'lunch', mealTypeLabel: 'Lunch' };
  }
  if (/\bbreakfast\b/i.test(lower)) {
    return { mealType: 'breakfast', mealTypeLabel: 'Breakfast' };
  }
  if (/\bsnack\b/i.test(lower)) {
    return { mealType: 'snack', mealTypeLabel: 'Snack' };
  }
  return null;
}

export type ParsedAddManualMeal = {
  title: string;
  mealType: string;
  mealTypeLabel: string;
};

/** "Add a protein shake to my meal plan", "add afternoon snack to today's plan". */
export function parseAddManualMealIntent(text: string): ParsedAddManualMeal | null {
  const lower = text.toLowerCase();
  if (!/\b(add|insert|include)\b/i.test(lower)) return null;
  if (
    !/\b(meal plan|my plan|today'?s plan|todays plan)\b/i.test(lower) &&
    !/\b(breakfast|lunch|dinner|snack|tonight|meal)\b/i.test(lower)
  ) {
    return null;
  }

  let mealType = 'snack';
  let mealTypeLabel = 'Snack';
  for (const [phrase, type] of Object.entries(MEAL_ALIASES)) {
    if (lower.includes(phrase)) {
      mealType = type;
      mealTypeLabel = type.charAt(0).toUpperCase() + type.slice(1);
      break;
    }
  }

  const quoted = text.match(/["“]([^"”]+)["”]/);
  const named = text.match(/\b(?:called|named|titled)\s+(.+?)(?:\s+to|\s+for|\s+on|$)/i);
  const addMatch = text.match(
    /\badd\s+(?:a\s+|an\s+)?(.+?)\s+(?:to|on|into)\s+(?:my\s+)?(?:today'?s\s+)?(?:meal\s+)?plan/i,
  );
  const title = (quoted?.[1] ?? named?.[1] ?? addMatch?.[1])
    ?.trim()
    .replace(/[.?!]+$/, '');
  if (!title || title.length < 2) return null;
  if (/^(a\s+)?(meal|snack)$/i.test(title)) return null;

  return { title, mealType, mealTypeLabel };
}

export type ParsedGenerateMealPlan = {
  duration: 'daily' | 'weekly';
  startDate: string;
};

/** "Generate a weekly meal plan", "create my meal plan for this week". */
export function parseGenerateMealPlanIntent(
  text: string,
): ParsedGenerateMealPlan | null {
  if (parseShoppingListIntent(text)) return null;
  const lower = text.toLowerCase();
  if (
    !/\b(generate|create|make|build|new)\b/i.test(lower) ||
    !/\bmeal\s*plan\b/i.test(lower)
  ) {
    return null;
  }
  const weekly = /\b(week|weekly|7\s*days|seven\s*days)\b/i.test(lower);
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  const startDate = iso?.[1] ?? new Date().toISOString().slice(0, 10);
  return {
    duration: weekly ? 'weekly' : 'daily',
    startDate,
  };
}

export type ParsedCreateRecipe = {
  query: string;
  meal?: string;
};

/** "Create a recipe for high-protein vegan buddha bowl", "save X to the recipe catalog". */
export function parseCreateRecipeIntent(text: string): ParsedCreateRecipe | null {
  const query = extractCreateRecipeQuery(text);
  if (!query) return null;
  if (!/\b(recipe|catalog|database)\b/i.test(text)) return null;

  const lower = text.toLowerCase();
  let meal: string | undefined;
  for (const [phrase, mealType] of Object.entries(MEAL_ALIASES)) {
    if (lower.includes(phrase)) {
      meal = mealType;
      break;
    }
  }
  return { query, meal };
}
