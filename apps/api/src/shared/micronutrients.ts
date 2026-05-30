export const MICRONUTRIENT_KEYS = [
  'vitamin_d',
  'vitamin_b12',
  'iron',
  'calcium',
  'magnesium',
  'fiber',
  'sodium',
] as const;

export type MicronutrientKey = (typeof MICRONUTRIENT_KEYS)[number];

export type MicronutrientMap = Record<MicronutrientKey, number>;

/** Adult daily reference values used for progress bars (sodium is an upper limit). */
export const MICRONUTRIENT_RDA: MicronutrientMap = {
  vitamin_d: 15, // mcg
  vitamin_b12: 2.4, // mcg
  iron: 18, // mg
  calcium: 1000, // mg
  magnesium: 420, // mg
  fiber: 28, // g
  sodium: 2300, // mg (max)
};

export const MICRONUTRIENT_LABELS: Record<MicronutrientKey, string> = {
  vitamin_d: 'Vitamin D',
  vitamin_b12: 'Vitamin B12',
  iron: 'Iron',
  calcium: 'Calcium',
  magnesium: 'Magnesium',
  fiber: 'Fiber',
  sodium: 'Sodium',
};

export const MICRONUTRIENT_UNITS: Record<MicronutrientKey, string> = {
  vitamin_d: 'mcg',
  vitamin_b12: 'mcg',
  iron: 'mg',
  calcium: 'mg',
  magnesium: 'mg',
  fiber: 'g',
  sodium: 'mg',
};

/** Foods suggested when a nutrient is below target (demo / education). */
export const MICRONUTRIENT_FOOD_SUGGESTIONS: Record<
  MicronutrientKey,
  string[]
> = {
  vitamin_d: ['salmon', 'egg', 'fortified dairy', 'mushrooms'],
  vitamin_b12: ['salmon', 'egg', 'greek yogurt', 'beef sirloin'],
  iron: ['lentils', 'spinach', 'beef sirloin', 'tofu', 'chickpeas'],
  calcium: ['greek yogurt', 'milk', 'cheddar', 'tofu', 'kale'],
  magnesium: ['spinach', 'almond', 'black beans', 'brown rice', 'avocado'],
  fiber: ['lentils', 'oats', 'broccoli', 'apple', 'chia seeds'],
  sodium: [
    'Use herbs instead of salt',
    'rinse canned beans',
    'limit processed meats',
  ],
};

export function emptyMicronutrients(): MicronutrientMap {
  return {
    vitamin_d: 0,
    vitamin_b12: 0,
    iron: 0,
    calcium: 0,
    magnesium: 0,
    fiber: 0,
    sodium: 0,
  };
}

export function addMicronutrients(
  a: MicronutrientMap,
  b: MicronutrientMap,
): MicronutrientMap {
  const out = { ...a };
  for (const key of MICRONUTRIENT_KEYS) {
    out[key] = roundMicro(key, a[key] + b[key]);
  }
  return out;
}

/** Estimate micronutrients from macros when explicit data is missing. */
export function estimateMicronutrientsFromMacros(macros: {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}): MicronutrientMap {
  const kcal = Math.max(macros.calories, 1);
  const proteinShare = (macros.protein * 4) / kcal;
  const carbShare = (macros.carbs * 4) / kcal;
  const fatShare = (macros.fats * 9) / kcal;

  return {
    vitamin_d: roundMicro('vitamin_d', 2 + proteinShare * 8 + fatShare * 4),
    vitamin_b12: roundMicro('vitamin_b12', 0.4 + proteinShare * 1.4),
    iron: roundMicro('iron', 1.2 + proteinShare * 7),
    calcium: roundMicro('calcium', 90 + proteinShare * 220 + carbShare * 100),
    magnesium: roundMicro('magnesium', 45 + carbShare * 90 + proteinShare * 50),
    fiber: roundMicro('fiber', 2 + carbShare * 14),
    sodium: roundMicro('sodium', 250 + fatShare * 350 + proteinShare * 120),
  };
}

export function micronutrientsFromMealNutrition(
  raw: unknown,
): MicronutrientMap {
  if (!raw || typeof raw !== 'object') {
    return emptyMicronutrients();
  }
  const n = raw as Record<string, unknown>;
  const micro = n.micronutrients;
  if (micro && typeof micro === 'object') {
    const m = micro as Record<string, unknown>;
    const out = emptyMicronutrients();
    for (const key of MICRONUTRIENT_KEYS) {
      const v = m[key];
      if (typeof v === 'number' && Number.isFinite(v)) {
        out[key] = roundMicro(key, v);
      }
    }
    if (MICRONUTRIENT_KEYS.some((k) => out[k] > 0)) {
      return out;
    }
  }
  const macros = {
    calories: typeof n.calories === 'number' ? n.calories : 0,
    protein: typeof n.protein === 'number' ? n.protein : 0,
    carbs: typeof n.carbs === 'number' ? n.carbs : 0,
    fats: typeof n.fats === 'number' ? n.fats : 0,
  };
  if (macros.calories <= 0) return emptyMicronutrients();
  return estimateMicronutrientsFromMacros(macros);
}

export function percentOfMicronutrientTarget(
  key: MicronutrientKey,
  intake: number,
): number {
  const target = MICRONUTRIENT_RDA[key];
  if (!target) return 0;
  if (key === 'sodium') {
    return Math.round((intake / target) * 1000) / 10;
  }
  return Math.round((intake / target) * 1000) / 10;
}

function roundMicro(key: MicronutrientKey, value: number): number {
  if (key === 'vitamin_d' || key === 'vitamin_b12') {
    return Math.round(value * 10) / 10;
  }
  if (key === 'fiber' || key === 'iron') {
    return Math.round(value * 10) / 10;
  }
  return Math.round(value);
}
