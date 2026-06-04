import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NutritionToolsService } from '../nutrition-tools/nutrition-tools.service';
import type { MacroNutrition } from '../shared/units';
import type { QuickFoodLogDto } from './dto/quick-food-log.dto';

@Injectable()
export class FoodLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nutritionTools: NutritionToolsService,
  ) {}

  async logQuick(userId: string, dto: QuickFoodLogDto) {
    const date = dto.date ?? new Date().toISOString().slice(0, 10);
    const title = dto.title.trim();
    if (!title) throw new BadRequestException('title is required');

    let nutrition: MacroNutrition;

    if (dto.recipeId) {
      const servings = dto.servings ?? 1;
      const scaled = await this.nutritionTools.scaleRecipeNutrition(
        dto.recipeId,
        servings,
      );
      nutrition = scaled.nutrition;
    } else if (dto.ingredients?.length) {
      const calc = await this.nutritionTools.calculateNutrition({
        ingredients: dto.ingredients.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
        })),
        servings: dto.servings ?? 1,
      });
      nutrition = {
        calories: Math.round(calc.calories),
        protein: Math.round(calc.protein),
        carbs: Math.round(calc.carbs),
        fats: Math.round(calc.fats),
      };
    } else {
      throw new BadRequestException(
        'Provide recipeId or at least one ingredient',
      );
    }

    const row = await this.prisma.mealIntakeLog.create({
      data: {
        userId,
        date,
        mealType: dto.mealType ?? 'snack',
        title,
        nutrition: nutrition as object,
        source: 'manual',
      },
    });

    return {
      id: row.id,
      date: row.date,
      title: row.title,
      mealType: row.mealType,
      nutrition,
      message: 'Food logged and added to today’s intake.',
    };
  }

  async listRecent(userId: string, limitRaw?: number) {
    const limit = Math.min(15, Math.max(1, Math.round(limitRaw ?? 8)));
    const rows = await this.prisma.mealIntakeLog.findMany({
      where: { userId },
      orderBy: { eatenAt: 'desc' },
      take: limit,
      select: {
        id: true,
        date: true,
        title: true,
        mealType: true,
        nutrition: true,
        source: true,
        eatenAt: true,
      },
    });
    return rows.map((r) => ({
      ...r,
      eatenAt: r.eatenAt.toISOString(),
    }));
  }
}
