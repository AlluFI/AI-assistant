/**
 * Demo user extras: activity logs (Record tab) + hidden nutrition intake history (charts only).
 * Run after demo-seed.sql: pnpm demo:seed
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { textToEmbedding } from '../src/shared/embeddings.util';

const DEMO_EMAIL = 'demo@numbers.local';
/** Backs nutrition analytics; excluded from GET /meal-plans (see demo-meal-plan.util). */
const DEMO_INTAKE_PLAN_ID = 'demo_intake_analytics_001';
const DEMO_INTAKE_VERSION_ID = 'demo_intake_version_001';
const DEMO_NUTRITION_PROFILE_ID = 'demo_nutrition_001';
const LEGACY_DEMO_MEAL_PLAN_ID = 'demo_meal_plan_001';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

type MealMacros = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

const MEAL_SLOTS: Array<{
  type: 'breakfast' | 'lunch' | 'dinner';
  hour: number;
  label: string;
  nutrition: MealMacros;
}> = [
  {
    type: 'breakfast',
    hour: 8,
    label: 'Breakfast',
    nutrition: { calories: 420, protein: 28, carbs: 42, fats: 14 },
  },
  {
    type: 'lunch',
    hour: 13,
    label: 'Lunch',
    nutrition: { calories: 580, protein: 38, carbs: 52, fats: 20 },
  },
  {
    type: 'dinner',
    hour: 19,
    label: 'Dinner',
    nutrition: { calories: 640, protein: 42, carbs: 48, fats: 24 },
  },
];

const ACTIVITY_SAMPLES: Array<{
  activityType: string;
  durationMinutes: number;
  notes: string;
}> = [
  {
    activityType: 'running',
    durationMinutes: 35,
    notes: 'Easy 5k — kept heart rate in zone 2.',
  },
  {
    activityType: 'strength',
    durationMinutes: 50,
    notes: 'Full-body circuit: squats, rows, push-ups, planks.',
  },
  {
    activityType: 'cycling',
    durationMinutes: 45,
    notes: 'Commute + extra laps along the waterfront.',
  },
  {
    activityType: 'yoga',
    durationMinutes: 40,
    notes: 'Vinyasa flow; focused on hip mobility.',
  },
  {
    activityType: 'walking',
    durationMinutes: 55,
    notes: 'Brisk walk during lunch break.',
  },
  {
    activityType: 'swimming',
    durationMinutes: 30,
    notes: '30 laps mixed freestyle and backstroke.',
  },
  {
    activityType: 'hiit',
    durationMinutes: 25,
    notes: '20/10 intervals on bike and bodyweight.',
  },
  {
    activityType: 'hiking',
    durationMinutes: 90,
    notes: 'Weekend trail; moderate elevation.',
  },
  {
    activityType: 'pilates',
    durationMinutes: 45,
    notes: 'Core and glute emphasis.',
  },
  {
    activityType: 'elliptical',
    durationMinutes: 32,
    notes: 'Steady state while catching up on a podcast.',
  },
];

function isoDateDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function atUtc(daysAgo: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setUTCHours(hour, minute, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d;
}

function scaleNutrition(
  base: MealMacros,
  dayIndex: number,
): MealMacros & { micronutrients: Record<string, number> } {
  const factor = 0.92 + (dayIndex % 5) * 0.04;
  const macros = {
    calories: Math.round(base.calories * factor),
    protein: Math.round(base.protein * factor),
    carbs: Math.round(base.carbs * factor),
    fats: Math.round(base.fats * factor),
  };
  const kcal = Math.max(macros.calories, 1);
  const proteinShare = (macros.protein * 4) / kcal;
  const carbShare = (macros.carbs * 4) / kcal;
  const fatShare = (macros.fats * 9) / kcal;
  return {
    ...macros,
    micronutrients: {
      vitamin_d: Math.round((2 + proteinShare * 8 + fatShare * 4) * 10) / 10,
      vitamin_b12: Math.round((0.4 + proteinShare * 1.4) * 10) / 10,
      iron: Math.round((1.2 + proteinShare * 7) * 10) / 10,
      calcium: Math.round(90 + proteinShare * 220 + carbShare * 100),
      magnesium: Math.round(45 + carbShare * 90 + proteinShare * 50),
      fiber: Math.round((2 + carbShare * 14) * 10) / 10,
      sodium: Math.round(250 + fatShare * 350 + proteinShare * 120),
    },
  };
}

async function cleanupDemoExtras(userId: string) {
  await prisma.activityLog.deleteMany({
    where: { userId, source: 'seed' },
  });

  const demoPlanIds = [DEMO_INTAKE_PLAN_ID, LEGACY_DEMO_MEAL_PLAN_ID];
  await prisma.plannedMeal.deleteMany({
    where: { version: { mealPlan: { userId, id: { in: demoPlanIds } } } },
  });
  await prisma.mealPlanVersion.deleteMany({
    where: { mealPlanId: { in: demoPlanIds } },
  });
  await prisma.mealPlan.deleteMany({
    where: { userId, id: { in: demoPlanIds } },
  });

  await prisma.nutritionProfile.deleteMany({
    where: { userId },
  });
}

async function seedNutritionProfile(userId: string) {
  await prisma.nutritionProfile.create({
    data: {
      id: DEMO_NUTRITION_PROFILE_ID,
      userId,
      timezone: 'Europe/Helsinki',
      cuisinePreferences: ['balanced', 'high_protein'],
      dislikedIngredients: [],
      calorieTarget: 2000,
      calorieTargetSource: 'manual',
      macroTargets: { protein: 130, carbs: 200, fats: 65 },
      mealsPerDay: 3,
      snacksPerDay: 0,
      preferredMealTimes: {
        breakfast: '08:00',
        lunch: '13:00',
        dinner: '19:00',
      },
      nutritionConfirmedAt: new Date(),
    },
  });
}

/** Logged intake rows for analytics only — not shown under Meal plans in the UI. */
async function seedNutritionIntakeHistory(userId: string) {
  await prisma.mealPlan.create({
    data: {
      id: DEMO_INTAKE_PLAN_ID,
      userId,
      duration: 'weekly',
      startDate: isoDateDaysAgo(89),
    },
  });

  await prisma.mealPlanVersion.create({
    data: {
      id: DEMO_INTAKE_VERSION_ID,
      mealPlanId: DEMO_INTAKE_PLAN_ID,
      versionLabel: 'Demo intake log',
      versionNumber: 1,
      isActive: true,
      preferencesSnapshot: {
        calorieTarget: 2000,
        source: 'demo-intake-seed',
        hiddenFromUi: true,
      },
    },
  });

  const meals: Prisma.PlannedMealCreateManyInput[] = [];
  let mealSeq = 0;
  const historyDays = 90;

  for (let daysAgo = historyDays - 1; daysAgo >= 0; daysAgo -= 1) {
    if (daysAgo % 11 === 0) continue;

    for (let slotIdx = 0; slotIdx < MEAL_SLOTS.length; slotIdx += 1) {
      const slot = MEAL_SLOTS[slotIdx]!;
      const eatenAt = atUtc(daysAgo, slot.hour, slotIdx * 5);
      mealSeq += 1;
      meals.push({
        id: `demo_intake_${String(mealSeq).padStart(5, '0')}`,
        versionId: DEMO_INTAKE_VERSION_ID,
        dayIndex: 0,
        mealType: slot.type,
        scheduledAt: eatenAt,
        title: slot.label,
        recipeId: null,
        nutrition: scaleNutrition(slot.nutrition, daysAgo),
        isManual: true,
        sortOrder: slotIdx,
        eatenAt,
      });
    }
  }

  for (let i = 0; i < meals.length; i += 100) {
    await prisma.plannedMeal.createMany({
      data: meals.slice(i, i + 100),
      skipDuplicates: true,
    });
  }

  console.log(
    `Demo nutrition intake: ${meals.length} logged meals over ~${historyDays} days (hidden from meal-plan UI).`,
  );
}

async function seedActivityLogs(userId: string) {
  const logs: Prisma.ActivityLogCreateManyInput[] = [];
  let seq = 0;

  for (let daysAgo = 89; daysAgo >= 0; daysAgo -= 1) {
    const weekBucket = Math.floor(daysAgo / 7);
    const sessionsThisWeek =
      weekBucket % 4 === 2 ? 2 : weekBucket % 3 === 0 ? 5 : weekBucket % 2 === 0 ? 4 : 3;

    if (daysAgo % 7 === 0) continue;

    const daySessions = Math.min(sessionsThisWeek, daysAgo % 5 === 0 ? 2 : 1);

    for (let s = 0; s < daySessions; s += 1) {
      const sample =
        ACTIVITY_SAMPLES[(daysAgo + s + weekBucket) % ACTIVITY_SAMPLES.length]!;
      seq += 1;
      const hour = 7 + ((daysAgo + s * 3) % 12);
      logs.push({
        id: `demo_act_${String(seq).padStart(4, '0')}`,
        userId,
        activityType: sample.activityType,
        activityAt: atUtc(daysAgo, hour, 15 + s * 20),
        durationMinutes: sample.durationMinutes,
        notes: sample.notes,
        source: 'seed',
      });
    }
  }

  for (let i = 0; i < logs.length; i += 100) {
    await prisma.activityLog.createMany({
      data: logs.slice(i, i + 100),
      skipDuplicates: true,
    });
  }

  console.log(`Demo activity logs: ${logs.length} entries.`);
}

function recipeEmbeddingBase(recipe: {
  title: string;
  cuisine: string;
  meal: string;
  summary: string;
  dietaryTags: unknown;
  communityRagText?: string | null;
  verified?: boolean;
  communityScore?: number | null;
}) {
  const tags = Array.isArray(recipe.dietaryTags)
    ? (recipe.dietaryTags as string[]).join(' ')
    : '';
  const community = recipe.communityRagText?.trim() ?? '';
  const verified = recipe.verified ? ' community verified favorite' : '';
  const score =
    recipe.communityScore != null && recipe.communityScore > 0
      ? ` community rating ${recipe.communityScore.toFixed(1)}`
      : '';
  return `${recipe.title} ${recipe.cuisine} ${recipe.meal} ${recipe.summary} ${tags}${verified}${score} ${community}`.trim();
}

async function refreshRecipeCommunity(recipeId: string) {
  const approved = await prisma.recipeFeedback.findMany({
    where: { recipeId, status: 'approved' },
    select: { rating: true, reviewText: true },
  });
  const count = approved.length;
  const communityScore =
    count > 0
      ? Math.round(
          (approved.reduce((s, r) => s + r.rating, 0) / count) * 10,
        ) / 10
      : null;
  const verified = count >= 3 && communityScore != null && communityScore >= 4;
  const snippets = approved
    .map((r) => r.reviewText?.trim())
    .filter((t): t is string => Boolean(t))
    .slice(0, 5);
  const communityRagText =
    snippets.length > 0
      ? `Community reviews: ${snippets.join(' | ')}`
      : verified
        ? 'Highly rated by the community.'
        : null;

  const recipe = await prisma.recipe.update({
    where: { id: recipeId },
    data: {
      communityScore,
      communityRatingCount: count,
      verified,
      communityRagText,
    },
  });

  const embedding = textToEmbedding(recipeEmbeddingBase(recipe));
  await prisma.recipe.update({
    where: { id: recipeId },
    data: { embedding: embedding as unknown as Prisma.InputJsonValue },
  });
}

async function seedCommunityRecipeFeedback(userId: string) {
  const recipeCount = await prisma.recipe.count();
  if (recipeCount < 5) {
    console.warn('Skipping community feedback seed: run pnpm nutrition:seed first.');
    return;
  }

  await prisma.recipeFeedback.deleteMany({
    where: { userId, id: { startsWith: 'demo_fb_' } },
  });

  const recipes = await prisma.recipe.findMany({
    orderBy: { id: 'asc' },
    take: 12,
    select: { id: true, title: true },
  });

  const reviews = [
    'Great weeknight option — balanced and filling.',
    'Easy to prep ahead; flavors work well together.',
    'Good protein for recovery days.',
    'Family-friendly and not too heavy.',
  ];

  for (let i = 0; i < recipes.length; i += 1) {
    const recipe = recipes[i]!;
    const rating = 4 + (i % 2);
    await prisma.recipeFeedback.create({
      data: {
        id: `demo_fb_${String(i + 1).padStart(3, '0')}`,
        recipeId: recipe.id,
        userId,
        rating,
        reviewText: reviews[i % reviews.length],
        status: 'approved',
      },
    });
    await refreshRecipeCommunity(recipe.id);
  }

  console.log(`Demo community feedback: ${recipes.length} approved reviews (RAG embeddings refreshed).`);
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    select: { id: true },
  });
  if (!user) {
    throw new Error(
      `Demo user not found (${DEMO_EMAIL}). Run prisma/demo-seed.sql first.`,
    );
  }

  await cleanupDemoExtras(user.id);
  await seedNutritionProfile(user.id);
  await seedNutritionIntakeHistory(user.id);
  await seedActivityLogs(user.id);
  await seedCommunityRecipeFeedback(user.id);
  console.log('Demo extras seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
