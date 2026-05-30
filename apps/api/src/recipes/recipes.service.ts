import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OpenAiClientService } from '../ai/openai-client.service';
import { NutritionService } from '../nutrition/nutrition.service';
import { PrismaService } from '../prisma/prisma.service';
import { RagService } from '../rag/rag.service';
import { NutritionToolsService } from '../nutrition-tools/nutrition-tools.service';
import {
  estimateMicronutrientsFromMacros,
  type MicronutrientMap,
} from '../shared/micronutrients';
import { EnhancedNutritionService } from '../enhanced-nutrition/enhanced-nutrition.service';
import { MacroNutrition } from '../shared/units';
import { RecipeSearchDto } from './dto/recipe-search.dto';
import { ScaleRecipeDto } from './dto/scale-recipe.dto';
import { SubstituteIngredientDto } from './dto/substitute-ingredient.dto';

@Injectable()
export class RecipesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rag: RagService,
    private readonly nutritionTools: NutritionToolsService,
    private readonly nutrition: NutritionService,
    private readonly openai: OpenAiClientService,
    private readonly enhancedNutrition: EnhancedNutritionService,
  ) {}

  async search(dto: RecipeSearchDto) {
    const q = dto.q?.trim() ?? '';
    const tagQuery = (dto.dietaryTags ?? [])
      .map((t) => t.trim())
      .filter(Boolean)
      .join(' ');
    const effectiveQ = q || tagQuery;

    if (effectiveQ) {
      const retrieved = await this.rag.searchRecipes(effectiveQ, {
        limit: dto.limit ?? 20,
        cuisine: dto.cuisine,
        dietaryTags: dto.dietaryTags,
        maxPrepMinutes: dto.maxPrepMinutes,
      });
      const ids = retrieved.map((r) => r.id);
      const recipes = await this.prisma.recipe.findMany({
        where: { id: { in: ids } },
        include: { ingredients: true },
      });
      const byId = new Map(recipes.map((r) => [r.id, r]));
      const ranked = retrieved
        .map((hit) => {
          const recipe = byId.get(hit.id);
          if (!recipe) return null;
          return {
            ...this.serializeRecipe(recipe),
            relevanceScore: hit.relevanceScore,
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .filter((row) =>
          this.hasAllDietaryTags(row.dietary_tags, dto.dietaryTags),
        )
        .filter(
          (row) =>
            !this.matchesAnyAllergy(row.ingredients, dto.allergies ?? []),
        );
      if (dto.meal) {
        const meal = dto.meal.toLowerCase();
        ranked.splice(
          0,
          ranked.length,
          ...ranked.filter((row) => row.meal.toLowerCase() === meal),
        );
      }
      if (dto.ingredient) {
        const term = dto.ingredient.toLowerCase();
        ranked.splice(
          0,
          ranked.length,
          ...ranked.filter((row) =>
            row.ingredients.some((i) => i.name.toLowerCase().includes(term)),
          ),
        );
      }
      const withMacros = await Promise.all(
        ranked.map(async (row) => ({
          row,
          nutrition: await this.getPerServingNutrition(row.id),
        })),
      );
      const ragResults = withMacros
        .filter(({ nutrition }) => this.passesNutritionFilters(nutrition, dto))
        .map(({ row, nutrition }) => {
          const recipe = byId.get(row.id);
          return {
            ...row,
            nutrition,
            enhanced_nutrition: recipe
              ? this.enhancedNutrition.recipeEnhancedFields(recipe, nutrition)
              : row.enhanced_nutrition,
          };
        });

      return ragResults.sort(
        (a, b) =>
          this.communitySortScore({
            verified: Boolean(b.verified),
            communityScore: b.community_score ?? null,
            communityRatingCount: b.community_rating_count ?? 0,
          }) -
          this.communitySortScore({
            verified: Boolean(a.verified),
            communityScore: a.community_score ?? null,
            communityRatingCount: a.community_rating_count ?? 0,
          }),
      );
    }

    const where: Prisma.RecipeWhereInput = {};
    if (dto.cuisine)
      where.cuisine = { equals: dto.cuisine, mode: 'insensitive' };
    if (dto.meal) where.meal = { equals: dto.meal, mode: 'insensitive' };
    if (dto.maxPrepMinutes) where.timeMinutes = { lte: dto.maxPrepMinutes };
    if (dto.ingredient) {
      where.ingredients = {
        some: { name: { contains: dto.ingredient, mode: 'insensitive' } },
      };
    }
    const recipes = await this.prisma.recipe.findMany({
      where,
      take: 500,
      include: { ingredients: true },
      orderBy: { title: 'asc' },
    });
    const filtered = recipes
      .filter((r) => this.hasAllDietaryTags(r.dietaryTags, dto.dietaryTags))
      .filter(
        (r) =>
          !this.matchesAnyAllergy(
            r.ingredients.map((i) => ({ name: i.name })),
            dto.allergies ?? [],
          ),
      )
      .slice(0, Math.min(50, dto.limit ?? 20));
    const withMacros = await Promise.all(
      filtered.map(async (recipe) => ({
        recipe,
        row: this.serializeRecipe(recipe),
        nutrition: await this.getPerServingNutrition(recipe.id),
      })),
    );
    const macroFiltered = withMacros
      .filter(({ nutrition }) => this.passesNutritionFilters(nutrition, dto))
      .map(({ row, recipe, nutrition }) => ({
        ...row,
        nutrition,
        enhanced_nutrition: this.enhancedNutrition.recipeEnhancedFields(
          recipe,
          nutrition,
        ),
      }));

    return macroFiltered.sort(
      (a, b) =>
        this.communitySortScore({
          verified: Boolean(b.verified),
          communityScore: b.community_score ?? null,
          communityRatingCount: b.community_rating_count ?? 0,
        }) -
        this.communitySortScore({
          verified: Boolean(a.verified),
          communityScore: a.community_score ?? null,
          communityRatingCount: a.community_rating_count ?? 0,
        }),
    );
  }

  async getById(id: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: { ingredients: { include: { ingredient: true } } },
    });
    if (!recipe) throw new NotFoundException('Recipe not found');
    const nutrition =
      await this.nutritionTools.scaleRecipeNutritionViaFunctionCall(
        id,
        recipe.servings,
      );
    const serialized = this.serializeRecipe(recipe);
    return {
      ...serialized,
      nutrition: nutrition.perServing,
      nutritionTotal: nutrition.nutrition,
      enhanced_nutrition: this.enhancedNutrition.recipeEnhancedFields(
        recipe,
        nutrition.perServing,
      ),
    };
  }

  async scale(dto: ScaleRecipeDto) {
    return this.nutritionTools.scaleRecipeNutritionViaFunctionCall(
      dto.recipeId,
      dto.servings,
    );
  }

  async substituteIngredient(
    userId: string,
    recipeId: string,
    dto: SubstituteIngredientDto,
  ) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: { ingredients: true },
    });
    if (!recipe) throw new NotFoundException('Recipe not found');

    const sourceIngredient = recipe.ingredients.find((line) =>
      line.name.toLowerCase().includes(dto.ingredient.trim().toLowerCase()),
    );
    if (!sourceIngredient) {
      throw new NotFoundException('Ingredient not found in this recipe');
    }

    const combined = await this.nutrition.getCombinedProfile(userId);
    const health = combined.healthProfile;
    const nutritionProfile = combined.nutritionProfile;
    const restrictions = [
      ...(Array.isArray(health?.dietaryRestrictions)
        ? health.dietaryRestrictions
        : []),
      ...(Array.isArray(health?.dietaryPreferences)
        ? health.dietaryPreferences
        : []),
    ];
    const disliked = Array.isArray(nutritionProfile?.dislikedIngredients)
      ? nutritionProfile.dislikedIngredients
      : [];
    const dislikedNames = disliked.filter(
      (item): item is string =>
        typeof item === 'string' && item.trim().length > 0,
    );

    const candidates = await this.prisma.ingredient.findMany({
      where: {
        label: {
          notIn: [sourceIngredient.name, ...dislikedNames],
        },
      },
      take: 80,
      orderBy: { label: 'asc' },
    });

    const fallbackAlternatives = candidates
      .filter(
        (candidate) =>
          !candidate.label
            .toLowerCase()
            .includes(sourceIngredient.name.toLowerCase()),
      )
      .slice(0, Math.max(1, Math.min(dto.limit ?? 3, 5)))
      .map((candidate) => ({
        ingredient: candidate.label,
        reason: 'Closest available database alternative.',
      }));

    if (!this.openai.apiKey) {
      return {
        sourceIngredient: sourceIngredient.name,
        usedFallback: true,
        alternatives: fallbackAlternatives,
      };
    }

    const aiInput = {
      recipe: {
        id: recipe.id,
        title: recipe.title,
        cuisine: recipe.cuisine,
        meal: recipe.meal,
      },
      sourceIngredient: sourceIngredient.name,
      sourceQuantity: sourceIngredient.quantity,
      restrictions,
      disliked,
      reason: dto.reason ?? 'preference',
      candidatePool: candidates.map((candidate) => candidate.label),
      maxAlternatives: Math.max(1, Math.min(dto.limit ?? 3, 5)),
    };

    type AiAlternative = {
      ingredient: string;
      reason: string;
      quantity?: number;
      unit?: string;
    };
    type AiResponse = {
      alternatives: AiAlternative[];
    };

    try {
      const ai = await this.openai.chatJson<AiResponse>(
        'You are a nutrition assistant. Return only valid JSON with alternatives array. Avoid allergens/restrictions/disliked ingredients. Use calculate_nutrition when needed to compare options.',
        `Suggest ingredient substitutions for this cooking scenario: ${JSON.stringify(aiInput)}`,
        { temperature: 0.3, tools: true },
      );
      const clean = (ai.alternatives ?? [])
        .filter(
          (alt) => typeof alt.ingredient === 'string' && alt.ingredient.trim(),
        )
        .slice(0, Math.max(1, Math.min(dto.limit ?? 3, 5)))
        .map((alt) => ({
          ingredient: alt.ingredient.trim(),
          reason:
            typeof alt.reason === 'string' && alt.reason.trim()
              ? alt.reason.trim()
              : 'Nutritionally and culinary suitable replacement.',
          quantity: alt.quantity,
          unit: alt.unit,
        }));
      if (!clean.length) {
        return {
          sourceIngredient: sourceIngredient.name,
          usedFallback: true,
          alternatives: fallbackAlternatives,
        };
      }
      return {
        sourceIngredient: sourceIngredient.name,
        usedFallback: false,
        alternatives: clean,
      };
    } catch {
      return {
        sourceIngredient: sourceIngredient.name,
        usedFallback: true,
        alternatives: fallbackAlternatives,
      };
    }
  }

  private serializeRecipe(
    recipe: Prisma.RecipeGetPayload<{ include: { ingredients: true } }>,
  ) {
    return {
      id: recipe.id,
      title: recipe.title,
      cuisine: recipe.cuisine,
      meal: recipe.meal,
      servings: recipe.servings,
      ingredients: recipe.ingredients.map((i) => ({
        id: i.ingredientId,
        name: i.name,
        quantity: i.quantity,
      })),
      summary: recipe.summary,
      time: recipe.timeMinutes,
      difficulty_level: recipe.difficultyLevel,
      dietary_tags: recipe.dietaryTags,
      source: recipe.source,
      img: recipe.img,
      preparation: recipe.preparation,
      community_score: recipe.communityScore,
      community_rating_count: recipe.communityRatingCount,
      verified: recipe.verified,
      enhanced_nutrition: this.enhancedNutrition.recipeEnhancedFields(recipe),
    };
  }

  private communitySortScore(recipe: {
    verified: boolean;
    communityScore: number | null;
    communityRatingCount: number;
  }): number {
    let s = 0;
    if (recipe.verified) s += 100;
    if (recipe.communityScore != null) s += recipe.communityScore * 10;
    s += Math.min(recipe.communityRatingCount, 20);
    return s;
  }

  private async getPerServingNutrition(
    recipeId: string,
  ): Promise<MacroNutrition> {
    const scaled =
      await this.nutritionTools.scaleRecipeNutritionViaFunctionCall(
        recipeId,
        1,
      );
    return scaled.perServing;
  }

  private normalizeDietaryTags(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((t) => String(t).trim().toLowerCase())
      .filter((t) => t.length > 0);
  }

  /** Recipe must include every requested tag (AND). */
  private hasAllDietaryTags(
    raw: unknown,
    required: string[] | undefined,
  ): boolean {
    if (!required?.length) return true;
    const tags = this.normalizeDietaryTags(raw);
    return required.every((req) => {
      const norm = req.trim().toLowerCase().replace(/_/g, '-');
      return tags.some((t) => t === norm || t.replace(/_/g, '-') === norm);
    });
  }

  private allergyKeywords(restriction: string): string[] {
    const key = restriction.trim().toLowerCase().replace(/-/g, '_');
    const map: Record<string, string[]> = {
      dairy_free: [
        'dairy',
        'milk',
        'cheese',
        'cream',
        'yogurt',
        'butter',
        'whey',
      ],
      lactose_intolerant: ['lactose', 'milk', 'cream', 'cheese'],
      gluten_free: ['gluten', 'wheat', 'barley', 'rye', 'flour'],
      nut_free: [
        'nut',
        'almond',
        'peanut',
        'walnut',
        'cashew',
        'pecan',
        'hazelnut',
        'pistachio',
      ],
      soy_free: ['soy', 'tofu', 'edamame'],
      egg_free: ['egg'],
      shellfish_free: ['shellfish', 'shrimp', 'prawn', 'crab', 'lobster'],
      fish_free: ['fish', 'salmon', 'tuna', 'cod', 'anchovy'],
      sesame_free: ['sesame', 'tahini'],
      halal: ['pork', 'alcohol', 'wine', 'bacon'],
      kosher: ['pork', 'shellfish', 'bacon'],
      fodmap_low: ['garlic', 'onion', 'apple', 'honey'],
    };
    if (map[key]) return map[key];
    return key
      .split('_')
      .filter((part) => part && !['free', 'low', 'intolerant'].includes(part));
  }

  private matchesAnyAllergy(
    ingredients: Array<{ name: string }>,
    allergies: string[],
  ): boolean {
    const allergyTerms = allergies
      .flatMap((entry) => this.allergyKeywords(entry))
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0);
    if (!allergyTerms.length) return false;
    return ingredients.some((ingredient) => {
      const name = ingredient.name.toLowerCase();
      return allergyTerms.some((allergy) => name.includes(allergy));
    });
  }

  private passesNutritionFilters(
    nutrition: MacroNutrition,
    dto: RecipeSearchDto,
  ): boolean {
    if (dto.minCalories != null && nutrition.calories < dto.minCalories) {
      return false;
    }
    if (dto.maxCalories != null && nutrition.calories > dto.maxCalories) {
      return false;
    }
    if (dto.minProtein != null && nutrition.protein < dto.minProtein) {
      return false;
    }
    if (dto.minCarbs != null && nutrition.carbs < dto.minCarbs) {
      return false;
    }
    if (dto.minFats != null && nutrition.fats < dto.minFats) {
      return false;
    }
    const micro = estimateMicronutrientsFromMacros(nutrition);
    if (!this.passesMicroBounds(micro, dto)) return false;
    return true;
  }

  private passesMicroBounds(
    micro: MicronutrientMap,
    dto: RecipeSearchDto,
  ): boolean {
    if (dto.minIron != null && micro.iron < dto.minIron) return false;
    if (dto.minFiber != null && micro.fiber < dto.minFiber) return false;
    if (dto.minVitaminD != null && micro.vitamin_d < dto.minVitaminD) {
      return false;
    }
    return true;
  }
}
