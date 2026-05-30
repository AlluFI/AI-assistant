import {
  MICRONUTRIENT_KEYS,
  MICRONUTRIENT_LABELS,
  emptyMicronutrients,
  estimateMicronutrientsFromMacros,
  micronutrientsFromMealNutrition,
  percentOfMicronutrientTarget,
} from './micronutrients';
import type {
  AntioxidantProfile,
  EnhancedMealPlanAnalytics,
  EnhancedRecipeNutrition,
  EnvironmentalImpact,
} from './enhanced-nutrition.types';
import type { MacroNutrition } from './units';

const LEVELS: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
const PROCESSING = [
  'minimally processed',
  'lightly processed',
  'moderately processed',
  'whole food',
] as const;

function seedFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function levelAt(seed: number, offset: number): 'low' | 'medium' | 'high' {
  return LEVELS[(seed + offset) % LEVELS.length];
}

export function deriveRecipeEnhancedNutrition(
  recipe: {
    id: string;
    meal: string;
    dietaryTags: unknown;
    timeMinutes: number;
    difficultyLevel: string;
    title?: string;
  },
  nutrition?: MacroNutrition | null,
): EnhancedRecipeNutrition {
  const h = seedFromString(recipe.id);
  const tags = Array.isArray(recipe.dietaryTags)
    ? (recipe.dietaryTags as string[]).map((t) => t.toLowerCase())
    : [];
  const n = nutrition ?? {
    calories: 400,
    protein: 20,
    carbs: 45,
    fats: 12,
  };

  const fiberTag = tags.some(
    (t) => t.includes('fiber') || t.includes('vegetarian'),
  );
  const lowCarb = tags.some(
    (t) => t.includes('low-carb') || t.includes('low carb'),
  );
  const highProtein = tags.some((t) => t.includes('protein'));

  let gi = 45 + (h % 35);
  if (lowCarb) gi = Math.min(gi, 45);
  if (fiberTag) gi = Math.min(gi, 55);
  gi = Math.max(15, Math.min(85, gi));

  const proteinFactor = Math.min(1, n.protein / 40);
  const density =
    Math.round(
      Math.min(10, Math.max(3, 5 + proteinFactor * 2 + (fiberTag ? 1.5 : 0))) *
        10,
    ) / 10;

  const satiety = Math.min(
    100,
    Math.max(
      40,
      Math.round(
        50 +
          proteinFactor * 25 +
          (n.fats / 30) * 10 +
          (recipe.meal === 'breakfast' ? -5 : 5),
      ),
    ),
  );

  const carbon: EnvironmentalImpact['carbon_footprint'] = tags.some(
    (t) => t.includes('vegan') || t.includes('vegetarian'),
  )
    ? 'low'
    : recipe.meal === 'dinner' && highProtein
      ? 'medium'
      : levelAt(h, 1);

  return {
    glycemic_index: gi,
    antioxidant_profile: {
      polyphenols: fiberTag ? 'high' : levelAt(h, 2),
      flavonoids: levelAt(h, 3),
      carotenoids: tags.some((t) => t.includes('vegetarian'))
        ? 'high'
        : levelAt(h, 4),
    },
    nutrient_density_score: density,
    processing_level: PROCESSING[h % PROCESSING.length],
    environmental_impact: {
      carbon_footprint: carbon,
      water_usage: fiberTag ? 'low' : levelAt(h, 5),
    },
    satiety_index: satiety,
  };
}

function parseMacro(raw: unknown): MacroNutrition {
  const n = raw as MacroNutrition;
  return {
    calories: Math.round(n?.calories ?? 0),
    protein: n?.protein ?? 0,
    carbs: n?.carbs ?? 0,
    fats: n?.fats ?? 0,
  };
}

const PLANT_KEYWORDS = [
  'tofu',
  'lentil',
  'bean',
  'chickpea',
  'spinach',
  'broccoli',
  'quinoa',
  'vegetable',
  'salad',
  'oat',
];
const ANIMAL_KEYWORDS = [
  'chicken',
  'beef',
  'salmon',
  'turkey',
  'pork',
  'fish',
  'egg',
  'shrimp',
];

export function computeMealPlanEnhancedAnalytics(
  meals: Array<{
    dayIndex: number;
    title: string;
    mealType: string;
    nutrition: unknown;
    recipe?: { cuisine?: string } | null;
  }>,
  targets: { calories: number; macros: MacroNutrition },
): EnhancedMealPlanAnalytics {
  const byDay = new Map<number, MacroNutrition[]>();
  for (const meal of meals) {
    const list = byDay.get(meal.dayIndex) ?? [];
    list.push(parseMacro(meal.nutrition));
    byDay.set(meal.dayIndex, list);
  }

  const dayTotals: MacroNutrition[] = [];
  for (const [, dayMeals] of byDay) {
    dayTotals.push(
      dayMeals.reduce(
        (acc, m) => ({
          calories: acc.calories + m.calories,
          protein: acc.protein + m.protein,
          carbs: acc.carbs + m.carbs,
          fats: acc.fats + m.fats,
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 },
      ),
    );
  }

  const avgDay =
    dayTotals.length > 0
      ? dayTotals.reduce(
          (acc, d) => ({
            calories: acc.calories + d.calories,
            protein: acc.protein + d.protein,
            carbs: acc.carbs + d.carbs,
            fats: acc.fats + d.fats,
          }),
          { calories: 0, protein: 0, carbs: 0, fats: 0 },
        )
      : { calories: 0, protein: 0, carbs: 0, fats: 0 };

  const days = Math.max(1, dayTotals.length);
  const avgCalories = avgDay.calories / days;
  const avgProtein = avgDay.protein / days;
  const avgCarbs = avgDay.carbs / days;
  const avgFats = avgDay.fats / days;

  const calPct = targets.calories > 0 ? avgCalories / targets.calories : 1;
  const proPct =
    targets.macros.protein > 0 ? avgProtein / targets.macros.protein : 1;
  const carbPct =
    targets.macros.carbs > 0 ? avgCarbs / targets.macros.carbs : 1;
  const fatPct = targets.macros.fats > 0 ? avgFats / targets.macros.fats : 1;
  const deviations = [calPct, proPct, carbPct, fatPct].map((p) =>
    Math.abs(1 - p),
  );
  const avgDev =
    deviations.reduce((s, d) => s + d, 0) / Math.max(1, deviations.length);
  const nutritional_balance_score =
    Math.round(Math.max(1, Math.min(10, 10 - avgDev * 12)) * 10) / 10;

  const cuisines = new Set(
    meals.map((m) => m.recipe?.cuisine?.toLowerCase()).filter(Boolean),
  );
  const mealTypes = new Set(meals.map((m) => m.mealType));
  const titles = new Set(meals.map((m) => m.title.toLowerCase()));
  const diversity_index =
    Math.round(
      Math.min(
        10,
        (cuisines.size / Math.max(1, meals.length)) * 4 +
          (mealTypes.size / 4) * 3 +
          (titles.size / Math.max(1, meals.length)) * 3,
      ) * 10,
    ) / 10;

  const microTotal = emptyMicronutrients();
  for (const meal of meals) {
    const m = micronutrientsFromMealNutrition(meal.nutrition);
    for (const key of MICRONUTRIENT_KEYS) {
      microTotal[key] += m[key];
    }
  }
  const microDays = Math.max(1, byDay.size);
  const avgMicro = emptyMicronutrients();
  for (const key of MICRONUTRIENT_KEYS) {
    avgMicro[key] = Math.round((microTotal[key] / microDays) * 10) / 10;
  }

  const deficiencies: string[] = [];
  const excess: string[] = [];
  let met = 0;
  for (const key of MICRONUTRIENT_KEYS) {
    const pct = percentOfMicronutrientTarget(key, avgMicro[key]);
    if (key === 'sodium') {
      if (pct > 115) {
        excess.push(MICRONUTRIENT_LABELS[key].toLowerCase());
      } else if (pct <= 100) met += 1;
    } else if (pct >= 85) {
      met += 1;
    } else if (pct < 85) {
      deficiencies.push(MICRONUTRIENT_LABELS[key].toLowerCase());
    }
  }
  const micronutrient_coverage = {
    percentage: Math.round((met / MICRONUTRIENT_KEYS.length) * 100),
    deficiencies,
    excess,
  };

  const proteins = dayTotals.map((d) => d.protein);
  const proteinSpread =
    proteins.length > 1 ? Math.max(...proteins) - Math.min(...proteins) : 0;
  const protein_consistency: 'low' | 'medium' | 'high' =
    proteinSpread < 15 ? 'high' : proteinSpread < 35 ? 'medium' : 'low';

  const fiber_trend = trendFromSeries(
    dayTotals.map((d) => estimateMicronutrientsFromMacros(d).fiber),
  );
  const sugar_trend = trendFromSeries(dayTotals.map((d) => d.carbs * 0.4));

  let plant = 0;
  let animal = 0;
  for (const meal of meals) {
    const t = meal.title.toLowerCase();
    if (PLANT_KEYWORDS.some((k) => t.includes(k))) plant += 1;
    if (ANIMAL_KEYWORDS.some((k) => t.includes(k))) animal += 1;
  }
  const plant_to_animal_ratio =
    animal > 0 ? Math.round((plant / animal) * 10) / 10 : plant > 0 ? plant : 1;
  const seasonal_ingredient_percentage = Math.min(
    95,
    Math.round(40 + cuisines.size * 8 + (fiberTagFromMeals(meals) ? 15 : 0)),
  );

  return {
    nutritional_balance_score,
    diversity_index,
    micronutrient_coverage,
    weekly_trends: {
      protein_consistency,
      fiber_trend,
      sugar_trend,
    },
    sustainability_metrics: {
      plant_to_animal_ratio,
      seasonal_ingredient_percentage,
    },
  };
}

function fiberTagFromMeals(meals: Array<{ title: string }>): boolean {
  return meals.some((m) =>
    ['spinach', 'broccoli', 'lentil', 'bean', 'quinoa', 'vegetable'].some((k) =>
      m.title.toLowerCase().includes(k),
    ),
  );
}

function trendFromSeries(
  values: number[],
): 'increasing' | 'stable' | 'decreasing' {
  if (values.length < 2) return 'stable';
  const first = values.slice(0, Math.ceil(values.length / 2));
  const second = values.slice(Math.ceil(values.length / 2));
  const a = first.reduce((s, v) => s + v, 0) / first.length;
  const b = second.reduce((s, v) => s + v, 0) / second.length;
  const delta = b - a;
  if (delta > 1.5) return 'increasing';
  if (delta < -1.5) return 'decreasing';
  return 'stable';
}

export function serializeEnhancedRecipe(
  row: {
    glycemicIndex?: number | null;
    antioxidantProfile?: unknown;
    nutrientDensityScore?: number | null;
    processingLevel?: string | null;
    environmentalImpact?: unknown;
    satietyIndex?: number | null;
  } | null,
): EnhancedRecipeNutrition | null {
  if (row?.glycemicIndex == null) return null;
  return {
    glycemic_index: row.glycemicIndex,
    antioxidant_profile: (row.antioxidantProfile ?? {}) as AntioxidantProfile,
    nutrient_density_score: row.nutrientDensityScore ?? 0,
    processing_level: row.processingLevel ?? 'unknown',
    environmental_impact: (row.environmentalImpact ?? {
      carbon_footprint: 'medium',
      water_usage: 'medium',
    }) as EnvironmentalImpact,
    satiety_index: row.satietyIndex ?? 0,
  };
}

/** Persisted enhanced-analytics columns on `MealPlanVersion` (independent of Prisma client generation). */
export type MealPlanVersionEnhancedColumns = {
  nutritionalBalanceScore?: number | null;
  diversityIndex?: number | null;
  micronutrientCoverage?: unknown;
  weeklyTrends?: unknown;
  sustainabilityMetrics?: unknown;
};

/** Read enhanced columns from a Prisma version row without relying on stale generated types. */
export function readMealPlanVersionEnhancedColumns(
  row: unknown,
): MealPlanVersionEnhancedColumns {
  const v = row as MealPlanVersionEnhancedColumns;
  return {
    nutritionalBalanceScore: v.nutritionalBalanceScore,
    diversityIndex: v.diversityIndex,
    micronutrientCoverage: v.micronutrientCoverage,
    weeklyTrends: v.weeklyTrends,
    sustainabilityMetrics: v.sustainabilityMetrics,
  };
}

export function serializeEnhancedMealPlanVersion(
  row: MealPlanVersionEnhancedColumns,
): EnhancedMealPlanAnalytics | null {
  if (row.nutritionalBalanceScore == null) return null;
  return {
    nutritional_balance_score: row.nutritionalBalanceScore,
    diversity_index: row.diversityIndex ?? 0,
    micronutrient_coverage: (row.micronutrientCoverage ?? {
      percentage: 0,
      deficiencies: [],
      excess: [],
    }) as EnhancedMealPlanAnalytics['micronutrient_coverage'],
    weekly_trends: (row.weeklyTrends ?? {
      protein_consistency: 'medium',
      fiber_trend: 'stable',
      sugar_trend: 'stable',
    }) as EnhancedMealPlanAnalytics['weekly_trends'],
    sustainability_metrics: (row.sustainabilityMetrics ?? {
      plant_to_animal_ratio: 1,
      seasonal_ingredient_percentage: 50,
    }) as EnhancedMealPlanAnalytics['sustainability_metrics'],
  };
}
