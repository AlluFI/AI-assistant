import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NutritionToolsService } from '../nutrition-tools/nutrition-tools.service';
import {
  computeMealPlanEnhancedAnalytics,
  deriveRecipeEnhancedNutrition,
  readMealPlanVersionEnhancedColumns,
  serializeEnhancedMealPlanVersion,
  serializeEnhancedRecipe,
} from '../shared/enhanced-nutrition.util';
import type { MacroNutrition } from '../shared/units';

@Injectable()
export class EnhancedNutritionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nutritionTools: NutritionToolsService,
  ) {}

  recipeEnhancedFields(
    recipe: {
      id: string;
      meal: string;
      dietaryTags: unknown;
      timeMinutes: number;
      difficultyLevel: string;
      title?: string;
      glycemicIndex?: number | null;
      antioxidantProfile?: unknown;
      nutrientDensityScore?: number | null;
      processingLevel?: string | null;
      environmentalImpact?: unknown;
      satietyIndex?: number | null;
    },
    nutrition?: MacroNutrition | null,
  ) {
    return (
      serializeEnhancedRecipe(recipe) ??
      deriveRecipeEnhancedNutrition(recipe, nutrition)
    );
  }

  async ensureRecipeEnhanced(
    recipeId: string,
    nutrition?: MacroNutrition | null,
  ) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
    });
    if (!recipe) return null;
    if (recipe.glycemicIndex != null) {
      return this.recipeEnhancedFields(recipe);
    }
    const macros =
      nutrition ??
      (
        await this.nutritionTools.scaleRecipeNutritionViaFunctionCall(
          recipeId,
          1,
        )
      ).perServing;
    const enhanced = deriveRecipeEnhancedNutrition(recipe, macros);
    await this.prisma.recipe.update({
      where: { id: recipeId },
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
    return enhanced;
  }

  async refreshVersionEnhanced(versionId: string) {
    const version = await this.prisma.mealPlanVersion.findUnique({
      where: { id: versionId },
      include: {
        meals: {
          include: {
            recipe: { select: { cuisine: true } },
          },
        },
      },
    });
    if (!version) return null;

    const prefs = (version.preferencesSnapshot ?? {}) as {
      calorie_target?: number;
      macronutrient_targets?: {
        protein: number;
        carbs: number;
        fats: number;
      };
    };
    const macroRaw = prefs.macronutrient_targets ?? {
      protein: 100,
      carbs: 200,
      fats: 60,
    };
    const targets = {
      calories: prefs.calorie_target ?? 2000,
      macros: {
        calories: 0,
        protein: macroRaw.protein,
        carbs: macroRaw.carbs,
        fats: macroRaw.fats,
      } satisfies MacroNutrition,
    };

    const analytics = computeMealPlanEnhancedAnalytics(
      version.meals.map((m) => ({
        dayIndex: m.dayIndex,
        title: m.title,
        mealType: m.mealType,
        nutrition: m.nutrition,
        recipe: m.recipe,
      })),
      targets,
    );

    await this.prisma.mealPlanVersion.update({
      where: { id: versionId },
      data: {
        nutritionalBalanceScore: analytics.nutritional_balance_score,
        diversityIndex: analytics.diversity_index,
        micronutrientCoverage:
          analytics.micronutrient_coverage as unknown as Prisma.InputJsonValue,
        weeklyTrends:
          analytics.weekly_trends as unknown as Prisma.InputJsonValue,
        sustainabilityMetrics:
          analytics.sustainability_metrics as unknown as Prisma.InputJsonValue,
      },
    });

    return analytics;
  }

  versionEnhancedAnalytics(version: unknown) {
    return serializeEnhancedMealPlanVersion(
      readMealPlanVersionEnhancedColumns(version),
    );
  }

  async backfillRecipes(batchSize = 100) {
    let cursor: string | undefined;
    let updated = 0;
    for (;;) {
      const rows = await this.prisma.recipe.findMany({
        where: { glycemicIndex: null },
        take: batchSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
        select: { id: true },
      });
      if (rows.length === 0) break;
      for (const row of rows) {
        await this.ensureRecipeEnhanced(row.id);
        updated += 1;
      }
      cursor = rows[rows.length - 1].id;
      if (rows.length < batchSize) break;
    }
    return updated;
  }
}
