import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OpenAiClientService } from '../ai/openai-client.service';
import { PrismaService } from '../prisma/prisma.service';
import { CalorieTargetService } from './calorie-target.service';
import { NutritionProfileUpdateDto } from './dto/nutrition-profile-update.dto';
import { validateAiTargetRecommendation } from './nutrition-target-recommendation.util';
import { CUISINE_VALUES } from '../shared/dietary-catalog';

@Injectable()
export class NutritionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calorieTargets: CalorieTargetService,
    private readonly openai: OpenAiClientService,
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
    const row = await this.upsertNutritionProfile(userId, {
      calorieTarget: computed.calories,
      calorieTargetSource: 'computed',
      macroTargets: computed.macros,
    });
    return {
      ...row,
      recommendationRationale: this.recommendationNoteForSource('computed'),
    };
  }

  async applyAiSuggestedTargets(userId: string) {
    const [health, nutrition] = await Promise.all([
      this.prisma.healthProfile.findUnique({ where: { userId } }),
      this.prisma.nutritionProfile.findUnique({ where: { userId } }),
    ]);
    const computed = this.calorieTargets.computeFromProfile(health);
    if (!computed) {
      throw new NotFoundException(
        'Insufficient health profile data to recommend targets',
      );
    }
    if (!this.openai.apiKey) {
      throw new ServiceUnavailableException(
        'AI recommendations are not configured (missing OPENAI_API_KEY)',
      );
    }

    const profilePayload = {
      health: health
        ? {
            age: health.age,
            gender: health.gender,
            weightKg: health.weightKg?.toString(),
            heightCm: health.heightCm?.toString(),
            targetWeightKg: health.targetWeightKg?.toString(),
            activityLevel: health.activityLevel,
            weeklyActivityDays: health.weeklyActivityDays,
            fitnessGoalPrimary: health.fitnessGoalPrimary,
            dietaryPreferences: health.dietaryPreferences,
            dietaryRestrictions: health.dietaryRestrictions,
            occupationType: health.occupationType,
          }
        : null,
      nutrition: nutrition
        ? {
            mealsPerDay: nutrition.mealsPerDay,
            snacksPerDay: nutrition.snacksPerDay,
            cuisinePreferences: nutrition.cuisinePreferences,
            dislikedIngredients: nutrition.dislikedIngredients,
          }
        : null,
      formulaBaseline: computed,
    };

    const ai = await this.openai.chatJson<{
      calories: number;
      macros: { protein: number; carbs: number; fats: number };
      rationale?: string;
    }>(
      `You are a sports nutrition coach. Recommend daily calorie and macro targets (grams) from the user's health profile and goals.
Return strict JSON only: {"calories": number, "macros": {"protein": number, "carbs": number, "fats": number}, "rationale": string}.
Rules:
- Non-medical, practical guidance only.
- Respect dietary restrictions and preferences (e.g. higher protein for high_protein, gluten-free does not change macros).
- Align with fitness goal (loss, maintenance, muscle gain).
- Use formulaBaseline as a starting anchor; adjust macros for goal (e.g. more protein for muscle, moderate deficit for loss).
- calories between 1200 and 6000; macros must sum to roughly calories (±15%).
- rationale: 1-2 short sentences.`,
      JSON.stringify(profilePayload),
      { temperature: 0.35, topP: 0.9 },
    );

    const validated = validateAiTargetRecommendation(ai);
    if (!validated) {
      const row = await this.upsertNutritionProfile(userId, {
        calorieTarget: computed.calories,
        calorieTargetSource: 'computed',
        macroTargets: computed.macros,
      });
      return {
        ...row,
        recommendationRationale: this.recommendationNoteForSource(
          'computed',
          'AI response was invalid; applied formula-based targets instead.',
        ),
      };
    }

    const row = await this.upsertNutritionProfile(userId, {
      calorieTarget: validated.calories,
      calorieTargetSource: 'ai_suggested',
      macroTargets: validated.macros,
    });
    return { ...row, recommendationRationale: validated.rationale ?? null };
  }

  recommendationNoteForSource(
    source: string | null | undefined,
    rationale?: string | null,
  ): string | null {
    if (rationale?.trim()) return rationale.trim();
    if (source === 'computed') {
      return 'Calculated with Mifflin–St Jeor from your weight, height, age, activity, and goal.';
    }
    return null;
  }
}
