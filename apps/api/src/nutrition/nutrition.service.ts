import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CalorieTargetService } from './calorie-target.service';
import { NutritionProfileUpdateDto } from './dto/nutrition-profile-update.dto';
import { CUISINE_VALUES } from '../shared/dietary-catalog';

@Injectable()
export class NutritionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calorieTargets: CalorieTargetService,
  ) {}

  async getCombinedProfile(userId: string) {
    const [health, nutrition] = await Promise.all([
      this.prisma.healthProfile.findUnique({ where: { userId } }),
      this.prisma.nutritionProfile.findUnique({ where: { userId } }),
    ]);
    const computed = this.calorieTargets.computeFromProfile(health);
    return {
      healthProfile: health,
      nutritionProfile: nutrition,
      suggestedTargets: computed,
      catalog: {
        cuisines: CUISINE_VALUES,
      },
    };
  }

  async upsertNutritionProfile(userId: string, dto: NutritionProfileUpdateDto) {
    const data: Prisma.NutritionProfileUpdateInput = {};
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.dislikedIngredients !== undefined) {
      data.dislikedIngredients =
        dto.dislikedIngredients as Prisma.InputJsonValue;
    }
    if (dto.cuisinePreferences !== undefined) {
      data.cuisinePreferences = dto.cuisinePreferences as Prisma.InputJsonValue;
    }
    if (dto.calorieTarget !== undefined) {
      data.calorieTarget = dto.calorieTarget;
      data.calorieTargetSource = dto.calorieTargetSource ?? 'manual';
    }
    if (dto.macroTargets !== undefined) {
      data.macroTargets = dto.macroTargets as unknown as Prisma.InputJsonValue;
    }
    if (dto.mealsPerDay !== undefined) data.mealsPerDay = dto.mealsPerDay;
    if (dto.snacksPerDay !== undefined) data.snacksPerDay = dto.snacksPerDay;
    if (dto.preferredMealTimes !== undefined) {
      data.preferredMealTimes = dto.preferredMealTimes as Prisma.InputJsonValue;
    }
    if (dto.confirm) {
      data.nutritionConfirmedAt = new Date();
    }

    const row = await this.prisma.nutritionProfile.upsert({
      where: { userId },
      create: {
        userId,
        timezone: dto.timezone ?? 'UTC',
        dislikedIngredients: (dto.dislikedIngredients ??
          []) as Prisma.InputJsonValue,
        cuisinePreferences: (dto.cuisinePreferences ??
          []) as Prisma.InputJsonValue,
        calorieTarget: dto.calorieTarget,
        calorieTargetSource: dto.calorieTargetSource,
        macroTargets: dto.macroTargets as unknown as
          | Prisma.InputJsonValue
          | undefined,
        mealsPerDay: dto.mealsPerDay ?? 3,
        snacksPerDay: dto.snacksPerDay ?? 0,
        preferredMealTimes: dto.preferredMealTimes as
          | Prisma.InputJsonValue
          | undefined,
        nutritionConfirmedAt: dto.confirm ? new Date() : undefined,
      },
      update: data,
    });
    return row;
  }

  async applySuggestedTargets(userId: string) {
    const health = await this.prisma.healthProfile.findUnique({
      where: { userId },
    });
    const computed = this.calorieTargets.computeFromProfile(health);
    if (!computed) {
      throw new NotFoundException(
        'Insufficient health profile data to compute targets',
      );
    }
    return this.upsertNutritionProfile(userId, {
      calorieTarget: computed.calories,
      calorieTargetSource: 'computed',
      macroTargets: computed.macros,
    });
  }
}
