/**
 * Seeds ≥500 ingredients and ≥500 recipes with vector embeddings.
 * Run: cd apps/api && pnpm exec ts-node --transpile-only prisma/seed-nutrition.ts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '@prisma/client';
import { textToEmbedding } from '../src/shared/embeddings.util';
import { CUISINE_VALUES } from '../src/shared/dietary-catalog';
import { deriveRecipeEnhancedNutrition } from '../src/shared/enhanced-nutrition.util';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const BASE_FOODS = [
  'quinoa', 'rice', 'chicken breast', 'salmon', 'tofu', 'lentils', 'black beans',
  'spinach', 'broccoli', 'sweet potato', 'oats', 'greek yogurt', 'egg', 'avocado',
  'olive oil', 'tomato', 'onion', 'garlic', 'cucumber', 'bell pepper', 'mushroom',
  'zucchini', 'carrot', 'kale', 'almond', 'walnut', 'cheddar', 'feta', 'milk',
  'lemon', 'lime', 'ginger', 'turmeric', 'cumin', 'paprika', 'basil', 'parsley',
  'whole wheat pasta', 'buckwheat', 'chia seeds', 'flax seeds', 'tuna', 'shrimp',
  'turkey', 'beef sirloin', 'pork tenderloin', 'cottage cheese', 'mozzarella',
  'brown rice', 'barley', 'chickpeas', 'edamame', 'asparagus', 'green beans',
  'cauliflower', 'brussels sprouts', 'beetroot', 'apple', 'banana', 'blueberry',
];

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
const TAGS = [
  'vegetarian', 'vegan', 'gluten-free', 'high-protein', 'low-carb', 'balanced',
];

function nutritionFor(label: string, idx: number) {
  const h = label.length + idx;
  return {
    calories: 80 + (h % 320),
    carbs: 5 + (h % 60),
    protein: 2 + (h % 25),
    fats: 1 + (h % 20),
  };
}

async function seedIngredients(count: number) {
  const existing = await prisma.ingredient.count();
  if (existing >= count) {
    console.log(`Ingredients already seeded (${existing})`);
    return;
  }
  const batch: Prisma.IngredientCreateInput[] = [];
  for (let i = 0; i < count; i++) {
    const base = BASE_FOODS[i % BASE_FOODS.length]!;
    const label = i < BASE_FOODS.length ? base : `${base} variant ${i}`;
    const id = `ing${String(i + 1).padStart(4, '0')}`;
    const embedding = textToEmbedding(label);
    batch.push({
      id,
      label,
      unit: 'gram',
      quantity: 100,
      nutrition: nutritionFor(label, i),
      embedding: embedding as unknown as Prisma.InputJsonValue,
    });
  }
  for (let i = 0; i < batch.length; i += 50) {
    await prisma.ingredient.createMany({
      data: batch.slice(i, i + 50),
      skipDuplicates: true,
    });
  }
  console.log(`Seeded ${count} ingredients`);
}

type IngredientRow = { id: string; label: string };

/** Each recipe must use distinct ingredientIds (composite PK on RecipeIngredient). */
function buildUniqueRecipeIngredients(
  pool: IngredientRow[],
  recipeIndex: number,
  targetCount: number,
): Array<{ ingredientId: string; name: string; quantity: number }> {
  const used = new Set<string>();
  const rows: Array<{ ingredientId: string; name: string; quantity: number }> = [];
  const poolSize = pool.length;
  for (let offset = 0; rows.length < targetCount && offset < poolSize; offset++) {
    const ing = pool[(recipeIndex + offset) % poolSize]!;
    if (used.has(ing.id)) continue;
    used.add(ing.id);
    rows.push({
      ingredientId: ing.id,
      name: ing.label,
      quantity: 50 + ((recipeIndex + rows.length) % 20) * 10,
    });
  }
  if (rows.length < Math.min(3, targetCount)) {
    throw new Error(
      `Not enough unique ingredients in pool (need ${targetCount}, got ${rows.length}, pool ${poolSize})`,
    );
  }
  return rows;
}

function assertUniqueIngredientIds(
  recipeId: string,
  rows: Array<{ ingredientId: string }>,
) {
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.ingredientId)) {
      throw new Error(
        `Duplicate ingredient ${row.ingredientId} in recipe ${recipeId}`,
      );
    }
    seen.add(row.ingredientId);
  }
}

async function seedRecipes(count: number) {
  const existing = await prisma.recipe.count();
  if (existing >= count) {
    console.log(`Recipes already seeded (${existing})`);
    return;
  }

  const ingredients = await prisma.ingredient.findMany({ orderBy: { id: 'asc' } });
  if (ingredients.length < 10) {
    throw new Error('Seed ingredients first');
  }

  const startFrom = existing;
  if (startFrom > 0) {
    console.log(`Resuming recipes from ${startFrom + 1}/${count}`);
  }

  for (let i = startFrom; i < count; i++) {
    const cuisine = CUISINE_VALUES[i % CUISINE_VALUES.length]!;
    const meal = MEALS[i % MEALS.length]!;
    const title = `${cuisine} ${meal} bowl #${i + 1}`;
    const id = `r${String(i + 1).padStart(4, '0')}`;
    const dietaryTags = [TAGS[i % TAGS.length]!, TAGS[(i + 2) % TAGS.length]!];
    const ingredientCount = 4 + (i % 4);
    const recipeIngredients = buildUniqueRecipeIngredients(
      ingredients,
      i,
      ingredientCount,
    );

    const preparation = [
      {
        step: 'Prep ingredients',
        description: 'Wash and chop vegetables; measure dry goods.',
        ingredients: recipeIngredients.slice(0, 2).map((x) => x.ingredientId),
      },
      {
        step: 'Cook',
        description: 'Cook base and protein until done.',
        ingredients: recipeIngredients.map((x) => x.ingredientId),
      },
      {
        step: 'Serve',
        description: 'Combine and season to taste.',
        ingredients: recipeIngredients.map((x) => x.ingredientId),
      },
    ];

    const summary = `A ${dietaryTags.join(', ')} ${cuisine} ${meal} with balanced macros.`;
    const embedding = textToEmbedding(`${title} ${cuisine} ${meal} ${summary} ${dietaryTags.join(' ')}`);

    assertUniqueIngredientIds(id, recipeIngredients);

    const existingRecipe = await prisma.recipe.findUnique({ where: { id } });
    if (existingRecipe) {
      continue;
    }

    const enhanced = deriveRecipeEnhancedNutrition({
      id,
      title,
      meal,
      dietaryTags,
      timeMinutes: 15 + (i % 45),
      difficultyLevel: DIFFICULTIES[i % DIFFICULTIES.length]!,
    });

    await prisma.recipe.create({
      data: {
        id,
        title,
        cuisine,
        meal,
        servings: 2 + (i % 3),
        summary,
        timeMinutes: 15 + (i % 45),
        difficultyLevel: DIFFICULTIES[i % DIFFICULTIES.length]!,
        dietaryTags,
        source: 'seed-database',
        img: `/images/recipes/${id}.jpg`,
        preparation,
        embedding: embedding as unknown as Prisma.InputJsonValue,
        glycemicIndex: enhanced.glycemic_index,
        antioxidantProfile:
          enhanced.antioxidant_profile as unknown as Prisma.InputJsonValue,
        nutrientDensityScore: enhanced.nutrient_density_score,
        processingLevel: enhanced.processing_level,
        environmentalImpact:
          enhanced.environmental_impact as unknown as Prisma.InputJsonValue,
        satietyIndex: enhanced.satiety_index,
      },
    });

    await prisma.recipeIngredient.createMany({
      data: recipeIngredients.map((ri) => ({
        recipeId: id,
        ingredientId: ri.ingredientId,
        name: ri.name,
        quantity: ri.quantity,
      })),
      skipDuplicates: true,
    });

    if ((i + 1) % 50 === 0) console.log(`Recipes: ${i + 1}/${count}`);
  }
  const finalCount = await prisma.recipe.count();
  console.log(`Recipes in database: ${finalCount} (target ${count})`);
}

async function backfillRecipeEnhanced() {
  const rows = await prisma.recipe.findMany({
    where: { glycemicIndex: null },
    select: {
      id: true,
      title: true,
      meal: true,
      dietaryTags: true,
      timeMinutes: true,
      difficultyLevel: true,
    },
  });
  for (const recipe of rows) {
    const enhanced = deriveRecipeEnhancedNutrition(recipe);
    await prisma.recipe.update({
      where: { id: recipe.id },
      data: {
        glycemicIndex: enhanced.glycemic_index,
        antioxidantProfile:
          enhanced.antioxidant_profile as unknown as Prisma.InputJsonValue,
        nutrientDensityScore: enhanced.nutrient_density_score,
        processingLevel: enhanced.processing_level,
        environmentalImpact:
          enhanced.environmental_impact as unknown as Prisma.InputJsonValue,
        satietyIndex: enhanced.satiety_index,
      },
    });
  }
  if (rows.length > 0) {
    console.log(`Backfilled enhanced nutrition on ${rows.length} recipes`);
  }
}

async function main() {
  const ingredientCount = Number(process.env.SEED_INGREDIENT_COUNT ?? 500);
  const recipeCount = Number(process.env.SEED_RECIPE_COUNT ?? 500);
  await seedIngredients(ingredientCount);
  await seedRecipes(recipeCount);
  await backfillRecipeEnhanced();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
