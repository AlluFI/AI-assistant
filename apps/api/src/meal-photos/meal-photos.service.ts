import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NutritionToolsService } from '../nutrition-tools/nutrition-tools.service';
import { GeminiVisionService } from './gemini-vision.service';
import type {
  DetectedFoodItem,
  MealPhotoNutrition,
  MealPhotoScanResult,
} from './meal-photo.types';

@Injectable()
export class MealPhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiVisionService,
    private readonly nutritionTools: NutritionToolsService,
  ) {}

  async analyze(
    userId: string,
    file: Express.Multer.File,
    opts?: { date?: string; mealType?: string },
  ): Promise<MealPhotoScanResult> {
    this.gemini.validateImage(file);
    const date = opts?.date ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('date must be YYYY-MM-DD');
    }

    let description = 'Meal from photo';
    let foods: DetectedFoodItem[] = [];
    try {
      const detected = await this.gemini.detectFoods(file, {
        mealType: opts?.mealType,
        date,
      });
      description = detected.description;
      foods = detected.items;
    } catch (e) {
      const row = await this.prisma.mealPhotoScan.create({
        data: {
          userId,
          status: 'failed',
          date,
          mealType: opts?.mealType ?? null,
          foods: [] as unknown as Prisma.InputJsonValue,
          errorMessage:
            e instanceof Error ? e.message : 'Vision analysis failed',
        },
      });
      throw e;
    }

    const { nutrition, unmatchedFoods, matchedCount } =
      await this.nutritionFromFoods(foods);

    const row = await this.prisma.mealPhotoScan.create({
      data: {
        userId,
        status: 'analyzed',
        date,
        mealType: opts?.mealType ?? null,
        description,
        foods: foods as unknown as Prisma.InputJsonValue,
        nutrition: nutrition
          ? (nutrition as unknown as Prisma.InputJsonValue)
          : undefined,
        unmatchedFoods: unmatchedFoods.length
          ? (unmatchedFoods as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });

    return this.toResult(row, matchedCount);
  }

  async getScan(userId: string, scanId: string) {
    const row = await this.prisma.mealPhotoScan.findFirst({
      where: { id: scanId, userId },
    });
    if (!row) throw new NotFoundException('Scan not found');
    const foods = this.parseFoods(row.foods);
    const unmatched = Array.isArray(row.unmatchedFoods)
      ? (row.unmatchedFoods as string[])
      : [];
    return this.toResult(
      row,
      foods.length - unmatched.length,
    );
  }

  async confirm(userId: string, scanId: string) {
    const scan = await this.prisma.mealPhotoScan.findFirst({
      where: { id: scanId, userId },
      include: { intakeLog: true },
    });
    if (!scan) throw new NotFoundException('Scan not found');
    if (scan.status === 'confirmed' && scan.intakeLog) {
      return {
        ok: true,
        alreadyConfirmed: true,
        intakeLogId: scan.intakeLog.id,
        scan: await this.getScan(userId, scanId),
      };
    }
    if (scan.status === 'failed') {
      throw new BadRequestException('This scan failed and cannot be confirmed');
    }
    const nutrition = scan.nutrition as MealPhotoNutrition | null;
    if (!nutrition?.calories) {
      throw new BadRequestException(
        'No nutrition could be calculated from detected foods. Edit items or try another photo.',
      );
    }

    const title =
      scan.description?.trim() ||
      `Photo meal${scan.mealType ? ` (${scan.mealType})` : ''}`;

    const intake = await this.prisma.mealIntakeLog.create({
      data: {
        userId,
        scanId: scan.id,
        date: scan.date,
        mealType: scan.mealType,
        title: title.slice(0, 200),
        source: 'photo',
        nutrition: nutrition as unknown as Prisma.InputJsonValue,
        eatenAt: new Date(),
      },
    });

    await this.prisma.mealPhotoScan.update({
      where: { id: scan.id },
      data: { status: 'confirmed' },
    });

    return {
      ok: true,
      intakeLogId: intake.id,
      message: `Logged ${nutrition.calories} kcal from photo.`,
      scan: await this.getScan(userId, scanId),
    };
  }

  async listRecent(userId: string, limit = 10) {
    const rows = await this.prisma.mealPhotoScan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(30, limit),
    });
    return rows.map((r) => {
      const foods = this.parseFoods(r.foods);
      const unmatched = Array.isArray(r.unmatchedFoods)
        ? (r.unmatchedFoods as string[])
        : [];
      return this.toResult(r, foods.length - unmatched.length);
    });
  }

  private async nutritionFromFoods(foods: DetectedFoodItem[]) {
    const unmatchedFoods: string[] = [];
    const ingredients: Array<{ name: string; quantity: number; unit: 'gram' }> =
      [];

    for (const f of foods) {
      const ing = await this.prisma.ingredient.findFirst({
        where: { label: { contains: f.name, mode: 'insensitive' } },
      });
      if (!ing) {
        unmatchedFoods.push(f.name);
        continue;
      }
      ingredients.push({
        name: f.name,
        quantity: f.quantityGrams,
        unit: 'gram',
      });
    }

    if (!ingredients.length) {
      return {
        nutrition: null,
        unmatchedFoods,
        matchedCount: 0,
      };
    }

    const calc = await this.nutritionTools.calculateNutrition({
      ingredients,
      servings: 1,
    });

    const nutrition: MealPhotoNutrition = {
      calories: Math.round(calc.calories),
      protein: Number(calc.protein.toFixed(1)),
      carbs: Number(calc.carbs.toFixed(1)),
      fats: Number(calc.fats.toFixed(1)),
      servings: calc.servings,
      perServing: calc.perServing,
    };

    return {
      nutrition,
      unmatchedFoods,
      matchedCount: ingredients.length,
    };
  }

  private parseFoods(value: unknown): DetectedFoodItem[] {
    if (!Array.isArray(value)) return [];
    const items: DetectedFoodItem[] = [];
    for (const row of value) {
      const o = row as Record<string, unknown>;
      const name = typeof o.name === 'string' ? o.name : '';
      const quantityGrams = Number(o.quantityGrams);
      if (!name || !Number.isFinite(quantityGrams)) continue;
      const item: DetectedFoodItem = { name, quantityGrams };
      if (typeof o.confidence === 'number') item.confidence = o.confidence;
      items.push(item);
    }
    return items;
  }

  private toResult(
    row: {
      id: string;
      status: string;
      date: string;
      mealType: string | null;
      description: string | null;
      foods: unknown;
      nutrition: unknown;
      unmatchedFoods: unknown;
      createdAt: Date;
    },
    matchedCount: number,
  ): MealPhotoScanResult {
    const unmatched = Array.isArray(row.unmatchedFoods)
      ? (row.unmatchedFoods as string[])
      : [];
    return {
      id: row.id,
      status: row.status,
      date: row.date,
      mealType: row.mealType,
      description: row.description,
      foods: this.parseFoods(row.foods),
      nutrition: (row.nutrition as MealPhotoNutrition | null) ?? null,
      unmatchedFoods: unmatched,
      matchedCount,
      disclaimer:
        'Calories and macros are calculated from the ingredient database, not from the AI vision model. Confirm to add to your daily intake.',
      createdAt: row.createdAt.toISOString(),
    };
  }
}
