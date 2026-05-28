import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  addMacros,
  emptyMacros,
  IngredientLine,
  MacroNutrition,
  scaleMacros,
} from '../shared/units';

export type CalculateNutritionArgs = {
  ingredients: Array<{ name: string; quantity: number; unit?: string }>;
  servings: number;
};

export type CalculateNutritionResult = MacroNutrition & {
  servings: number;
  perServing: MacroNutrition;
};

export type ToolExecutionMeta = {
  functionCall: {
    name: string;
    args: Record<string, unknown>;
    executedAt: string;
  };
};

@Injectable()
export class NutritionToolsService {
  constructor(private readonly prisma: PrismaService) {}

  readonly toolDefinitions = [
    {
      type: 'function' as const,
      function: {
        name: 'calculate_nutrition',
        description:
          'Calculates nutritional information for a recipe or ingredient list using the nutrition database',
        parameters: {
          type: 'object',
          properties: {
            ingredients: {
              type: 'array',
              description:
                'List of ingredients with quantities in grams or milliliters',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  quantity: { type: 'number' },
                  unit: { type: 'string', enum: ['gram', 'milliliter'] },
                },
                required: ['name', 'quantity'],
              },
            },
            servings: {
              type: 'number',
              description: 'Number of servings in the recipe',
            },
          },
          required: ['ingredients', 'servings'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'scale_recipe_nutrition',
        description:
          'Scales a stored recipe to a new serving count and recalculates nutrition',
        parameters: {
          type: 'object',
          properties: {
            recipeId: { type: 'string' },
            servings: { type: 'number' },
          },
          required: ['recipeId', 'servings'],
        },
      },
    },
  ];

  async executeTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      if (name === 'calculate_nutrition') {
        return this.calculateNutrition(this.parseCalculateArgs(args));
      }
      if (name === 'scale_recipe_nutrition') {
        const recipeId =
          typeof args.recipeId === 'string' ? args.recipeId.trim() : '';
        const servings = Number(args.servings);
        if (!recipeId || !Number.isFinite(servings) || servings <= 0) {
          throw new BadRequestException('Invalid recipeId or servings');
        }
        return this.scaleRecipeNutrition(recipeId, servings);
      }
      throw new BadRequestException(`Unknown tool: ${name}`);
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      const msg = e instanceof Error ? e.message : 'Tool execution failed';
      throw new BadRequestException(msg);
    }
  }

  async calculateNutritionViaFunctionCall(
    input: CalculateNutritionArgs,
  ): Promise<CalculateNutritionResult & ToolExecutionMeta> {
    const args: Record<string, unknown> = {
      ingredients: input.ingredients,
      servings: input.servings,
    };
    const result = (await this.executeTool(
      'calculate_nutrition',
      args,
    )) as CalculateNutritionResult;
    return {
      ...result,
      functionCall: {
        name: 'calculate_nutrition',
        args,
        executedAt: new Date().toISOString(),
      },
    };
  }

  async scaleRecipeNutritionViaFunctionCall(
    recipeId: string,
    servings: number,
  ): Promise<
    Awaited<ReturnType<NutritionToolsService['scaleRecipeNutrition']>> &
      ToolExecutionMeta
  > {
    const args: Record<string, unknown> = { recipeId, servings };
    const result = (await this.executeTool(
      'scale_recipe_nutrition',
      args,
    )) as Awaited<ReturnType<NutritionToolsService['scaleRecipeNutrition']>>;
    return {
      ...result,
      functionCall: {
        name: 'scale_recipe_nutrition',
        args,
        executedAt: new Date().toISOString(),
      },
    };
  }

  async calculateNutrition(
    input: CalculateNutritionArgs,
  ): Promise<CalculateNutritionResult> {
    const servings = Math.max(1, Math.floor(input.servings));
    const lines: IngredientLine[] = input.ingredients.map((i) => ({
      name: i.name.trim(),
      quantity: i.quantity,
      unit: i.unit === 'milliliter' ? 'milliliter' : 'gram',
    }));
    const total = await this.sumIngredientLines(lines);
    return {
      ...total,
      servings,
      perServing: scaleMacros(total, 1 / servings),
    };
  }

  async scaleRecipeNutrition(recipeId: string, newServings: number) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: { ingredients: { include: { ingredient: true } } },
    });
    if (!recipe) {
      throw new BadRequestException('Recipe not found');
    }
    const baseServings = Math.max(1, recipe.servings);
    const factor = newServings / baseServings;
    const lines: IngredientLine[] = recipe.ingredients.map((ri) => ({
      id: ri.ingredientId,
      name: ri.name,
      quantity: ri.quantity * factor,
      unit: 'gram',
    }));
    const total = await this.sumIngredientLines(lines);
    return {
      recipeId,
      baseServings,
      servings: newServings,
      scaledIngredients: lines,
      nutrition: total,
      perServing: scaleMacros(total, 1 / newServings),
    };
  }

  private parseCalculateArgs(
    args: Record<string, unknown>,
  ): CalculateNutritionArgs {
    const raw = args.ingredients;
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new BadRequestException('ingredients array is required');
    }
    const servings = Number(args.servings);
    if (!Number.isFinite(servings) || servings <= 0) {
      throw new BadRequestException('servings must be a positive number');
    }
    const ingredients = raw.map((item) => {
      const row = item as Record<string, unknown>;
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      const quantity = Number(row.quantity);
      if (!name || !Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException(
          'Each ingredient needs name and quantity',
        );
      }
      const unit = row.unit === 'milliliter' ? 'milliliter' : 'gram';
      return { name, quantity, unit };
    });
    return { ingredients, servings };
  }

  private async sumIngredientLines(
    lines: IngredientLine[],
  ): Promise<MacroNutrition> {
    let total = emptyMacros();
    for (const line of lines) {
      const ing = await this.findIngredient(line);
      if (!ing) continue;
      const nutrition = ing.nutrition as MacroNutrition;
      const refQty = ing.quantity || 100;
      const factor = line.quantity / refQty;
      total = addMacros(total, scaleMacros(nutrition, factor));
    }
    return total;
  }

  private async findIngredient(line: IngredientLine) {
    if (line.id) {
      return this.prisma.ingredient.findUnique({ where: { id: line.id } });
    }
    const byLabel = await this.prisma.ingredient.findFirst({
      where: { label: { equals: line.name, mode: 'insensitive' } },
    });
    if (byLabel) return byLabel;
    return this.prisma.ingredient.findFirst({
      where: { label: { contains: line.name, mode: 'insensitive' } },
    });
  }
}
