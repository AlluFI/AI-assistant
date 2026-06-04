import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileService } from '../../profile/profile.service';
import { NutritionService } from '../../nutrition/nutrition.service';
import type { ProfileUpdateDto } from '../../profile/dto/profile-update.dto';
import type { AssistantUiBlock } from '../assistant-ui.types';
import {
  healthBasicsMissing,
  parseHealthBasicsFromText,
} from './onboarding-health-parse.util';

export type OnboardingStepId =
  | 'health_basics'
  | 'nutrition_targets'
  | 'meal_schedule'
  | 'complete';

export type WingmanOnboardingStatus = {
  active: boolean;
  step: OnboardingStepId;
  steps: Array<{ id: OnboardingStepId; label: string; done: boolean }>;
  percentComplete: number;
  opener: { content: string; uiBlocks?: AssistantUiBlock[] };
};

const DEFAULT_MEAL_TIMES: Record<string, string> = {
  breakfast: '2026-01-01T08:00:00.000Z',
  lunch: '2026-01-01T12:30:00.000Z',
  dinner: '2026-01-01T19:00:00.000Z',
};

@Injectable()
export class WingmanOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profile: ProfileService,
    private readonly nutrition: NutritionService,
  ) {}

  async getStatus(userId: string): Promise<WingmanOnboardingStatus> {
    const step = await this.resolveStep(userId);
    const steps = this.stepList(step);
    const doneCount = steps.filter((s) => s.done).length;
    const active = await this.isActive(userId, step);
    return {
      active,
      step,
      steps,
      percentComplete: active
        ? Math.round((doneCount / steps.length) * 100)
        : 100,
      opener: this.openerForStep(step),
    };
  }

  async skip(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { wingmanOnboardingSkippedAt: new Date() },
    });
    return { ok: true, skipped: true };
  }

  async complete(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { wingmanOnboardingCompletedAt: new Date() },
    });
    return { ok: true, completed: true };
  }

  /** Scripted wingman replies while onboarding is active. */
  async handleMessage(
    userId: string,
    message: string,
  ): Promise<{ content: string; uiBlocks?: AssistantUiBlock[] } | null> {
    const step = await this.resolveStep(userId);
    if (!(await this.isActive(userId, step))) return null;

    const trimmed = message.trim();
    if (this.isSkipMessage(trimmed)) {
      return {
        content:
          'Skip setup for now? You can finish later in Wingman or the Profile / Nutrition tabs.',
        uiBlocks: [
          {
            type: 'cta' as const,
            label: 'Confirm: Skip setup',
            action: 'confirm_onboarding_skip' as const,
          },
        ],
      };
    }

    switch (step) {
      case 'health_basics':
        return this.handleHealthBasics(userId, trimmed);
      case 'nutrition_targets':
        return this.handleNutritionTargets(trimmed);
      case 'meal_schedule':
        return this.handleMealSchedule(userId, trimmed);
      default:
        return null;
    }
  }

  async applyMealDefaults(userId: string) {
    await this.nutrition.upsertNutritionProfile(userId, {
      mealsPerDay: 3,
      snacksPerDay: 0,
      preferredMealTimes: DEFAULT_MEAL_TIMES,
    });
    await this.complete(userId);
    return {
      message:
        'Saved default meal schedule (3 meals, standard UTC times). Setup complete — explore Overview or ask me anything.',
      uiBlocks: [
        {
          type: 'cta' as const,
          label: 'Open Overview',
          action: 'open_record' as const,
          payload: { focus: 'overview' },
        },
      ],
    };
  }

  private async isActive(
    userId: string,
    step: OnboardingStepId,
  ): Promise<boolean> {
    if (step === 'complete') {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { wingmanOnboardingCompletedAt: true },
      });
      if (!user?.wingmanOnboardingCompletedAt) {
        await this.complete(userId);
      }
      return false;
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        wingmanOnboardingCompletedAt: true,
        wingmanOnboardingSkippedAt: true,
      },
    });
    if (!user) return false;
    if (user.wingmanOnboardingCompletedAt || user.wingmanOnboardingSkippedAt) {
      return false;
    }
    return true;
  }

  private async resolveStep(userId: string): Promise<OnboardingStepId> {
    const [health, nutrition] = await Promise.all([
      this.prisma.healthProfile.findUnique({ where: { userId } }),
      this.prisma.nutritionProfile.findUnique({ where: { userId } }),
    ]);

    const healthMissing = healthBasicsMissing(
      {},
      {
        age: health?.age,
        heightCm: health?.heightCm?.toNumber() ?? null,
        weightKg: health?.weightKg?.toNumber() ?? null,
        activityLevel: health?.activityLevel,
        fitnessGoalPrimary: health?.fitnessGoalPrimary,
      },
    );
    if (healthMissing.length > 0) return 'health_basics';

    const cal = nutrition?.calorieTarget;
    if (cal == null || cal < 800) return 'nutrition_targets';

    const times = nutrition?.preferredMealTimes;
    const hasTimes =
      times != null &&
      typeof times === 'object' &&
      Object.keys(times as object).length > 0;
    if (!hasTimes) return 'meal_schedule';

    return 'complete';
  }

  private stepList(current: OnboardingStepId) {
    const order: OnboardingStepId[] = [
      'health_basics',
      'nutrition_targets',
      'meal_schedule',
      'complete',
    ];
    const idx = order.indexOf(current);
    return [
      { id: 'health_basics' as const, label: 'Health basics', done: idx > 0 },
      {
        id: 'nutrition_targets' as const,
        label: 'Calorie & macros',
        done: idx > 1,
      },
      { id: 'meal_schedule' as const, label: 'Meal schedule', done: idx > 2 },
    ];
  }

  private openerForStep(step: OnboardingStepId): {
    content: string;
    uiBlocks?: AssistantUiBlock[];
  } {
    if (step === 'health_basics') {
      return {
        content: `Welcome — I'll get you set up in a few quick steps (all here in chat).

**Step 1 — Health basics**  
Reply in one message with your **age**, **height (cm)**, **weight (kg)**, **activity level** (sedentary / light / moderate / active / very_active), and **goal** (weight_loss / muscle_gain / maintenance / general_fitness). Optional: gender.

Example: *I'm 28, 180 cm, 82 kg, moderately active, goal muscle gain*`,
        uiBlocks: [
          {
            type: 'hint' as const,
            text: 'You can skip setup and finish later in Profile or Nutrition.',
          },
          {
            type: 'cta' as const,
            label: 'Skip setup for now',
            action: 'confirm_onboarding_skip' as const,
          },
        ],
      };
    }
    if (step === 'nutrition_targets') {
      return {
        content: `**Step 2 — Daily targets**  
Choose how to set calories and macros. I recommend **AI targets** from your profile; **formula** uses Mifflin–St Jeor.`,
        uiBlocks: [
          {
            type: 'cta' as const,
            label: 'Confirm: AI recommend targets',
            action: 'confirm_onboarding_ai_targets' as const,
          },
          {
            type: 'cta' as const,
            label: 'Confirm: Formula targets',
            action: 'confirm_onboarding_formula_targets' as const,
          },
        ],
      };
    }
    if (step === 'meal_schedule') {
      return {
        content: `**Step 3 — Meal schedule**  
How many **snacks per day** (0–2)? Or use default times (breakfast 08:00, lunch 12:30, dinner 19:00 UTC).`,
        uiBlocks: [
          {
            type: 'cta' as const,
            label: 'Confirm: Default schedule (3 meals, no snacks)',
            action: 'confirm_onboarding_meal_defaults' as const,
          },
        ],
      };
    }
    return {
      content: 'Your setup is complete. Ask me about meal plans, calories, or logging weight and activities.',
    };
  }

  private isSkipMessage(text: string): boolean {
    return /\b(skip|later|not now|finish later)\b/i.test(text);
  }

  private async handleHealthBasics(userId: string, message: string) {
    const health = await this.prisma.healthProfile.findUnique({
      where: { userId },
    });
    const parsed = parseHealthBasicsFromText(message);
    const snacksOnly = /\b(\d)\s*snacks?\b/i.test(message);
    if (snacksOnly && Object.keys(parsed).length <= 1) {
      return {
        content:
          'We are still on health basics — send age, height, weight, activity, and goal first.',
      };
    }

    const missing = healthBasicsMissing(parsed, {
      age: health?.age,
      heightCm: health?.heightCm?.toNumber() ?? null,
      weightKg: health?.weightKg?.toNumber() ?? null,
      activityLevel: health?.activityLevel,
      fitnessGoalPrimary: health?.fitnessGoalPrimary,
    });

    if (Object.keys(parsed).length === 0 && missing.length > 0) {
      return {
        content: `Please send: ${missing.join(', ')}.`,
        uiBlocks: this.openerForStep('health_basics').uiBlocks,
      };
    }

    const dto: ProfileUpdateDto = {};
    if (parsed.age != null) dto.age = parsed.age;
    if (parsed.gender) dto.gender = parsed.gender;
    if (parsed.heightCm != null) dto.heightCm = parsed.heightCm;
    if (parsed.weightKg != null) {
      dto.weightKg = parsed.weightKg;
      dto.startingWeightKg = parsed.weightKg;
    }
    if (parsed.activityLevel) dto.activityLevel = parsed.activityLevel;
    if (parsed.fitnessGoalPrimary) {
      dto.fitnessGoalPrimary = parsed.fitnessGoalPrimary;
    }

    if (Object.keys(dto).length > 0) {
      await this.profile.upsert(userId, dto);
    }

    const after = await this.prisma.healthProfile.findUnique({
      where: { userId },
    });
    const stillMissing = healthBasicsMissing(
      {},
      {
        age: after?.age,
        heightCm: after?.heightCm?.toNumber() ?? null,
        weightKg: after?.weightKg?.toNumber() ?? null,
        activityLevel: after?.activityLevel,
        fitnessGoalPrimary: after?.fitnessGoalPrimary,
      },
    );

    if (stillMissing.length > 0) {
      return {
        content: `Saved what I could. Still need: ${stillMissing.join(', ')}.`,
      };
    }

    const next = this.openerForStep('nutrition_targets');
    return {
      content: `Health profile saved.\n\n${next.content}`,
      uiBlocks: next.uiBlocks,
    };
  }

  private handleNutritionTargets(message: string) {
    const lower = message.toLowerCase();
    if (/\b(ai|personalized|recommend)\b/i.test(lower)) {
      return {
        content: 'I can apply **AI-recommended** calorie and macro targets from your profile.',
        uiBlocks: [
          {
            type: 'cta' as const,
            label: 'Confirm: AI recommend targets',
            action: 'confirm_onboarding_ai_targets' as const,
          },
        ],
      };
    }
    if (/\b(formula|mifflin|computed|calculate)\b/i.test(lower)) {
      return {
        content: 'I can apply **formula-based** targets (Mifflin–St Jeor).',
        uiBlocks: [
          {
            type: 'cta' as const,
            label: 'Confirm: Formula targets',
            action: 'confirm_onboarding_formula_targets' as const,
          },
        ],
      };
    }
    return this.openerForStep('nutrition_targets');
  }

  private async handleMealSchedule(userId: string, message: string) {
    const snackMatch = message.match(/\b(\d)\s*snacks?\b/i);
    if (snackMatch) {
      const snacks = Math.min(2, Math.max(0, Number(snackMatch[1])));
      const times: Record<string, string> = { ...DEFAULT_MEAL_TIMES };
      if (snacks >= 1) {
        times.snack = '2026-01-01T15:00:00.000Z';
      }
      if (snacks >= 2) {
        times.snack_2 = '2026-01-01T10:30:00.000Z';
      }
      await this.nutrition.upsertNutritionProfile(userId, {
        mealsPerDay: 3,
        snacksPerDay: snacks,
        preferredMealTimes: times,
      });
      await this.complete(userId);
      return {
        content: `Saved ${snacks} snack(s) per day with standard meal times. **Setup complete** — you're ready to use the app.`,
        uiBlocks: [
          {
            type: 'cta' as const,
            label: 'Open Overview',
            action: 'open_record' as const,
            payload: { focus: 'overview' },
          },
        ],
      };
    }

    if (/\b(default|standard|no snacks)\b/i.test(message)) {
      return {
        content: 'Apply the default meal schedule?',
        uiBlocks: [
          {
            type: 'cta' as const,
            label: 'Confirm: Default schedule (3 meals, no snacks)',
            action: 'confirm_onboarding_meal_defaults' as const,
          },
        ],
      };
    }

    return this.openerForStep('meal_schedule');
  }

  formatOnboardingContext(step: OnboardingStepId): string {
    return `\n\n## Active setup wizard (onboarding)
- Current step: ${step}
- Collect only what this step needs; use tools \`update_health_profile\`, \`update_nutrition_targets\`, \`update_nutrition_preferences\` when the user gives explicit values.
- Offer confirm buttons for AI/formula targets and default meal schedule rather than inventing saves.
- If the user wants to skip, tell them they can tap "Skip setup for now".`;
  }
}
