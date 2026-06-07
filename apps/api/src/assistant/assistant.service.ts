import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAiClientService } from '../ai/openai-client.service';
import { AssistantLlmService } from '../ai/llm/assistant-llm.service';
import { AssistantWingmanService } from './assistant-wingman.service';
import { ThreadSummaryService } from './thread-summary.service';
import { UserMemoryService } from './user-memory.service';
import type { WingmanStreamEvent } from '../ai/llm/wingman-stream.types';
import { MealPlansService } from '../meal-plans/meal-plans.service';
import { ProfileService } from '../profile/profile.service';
import { ShoppingListsService } from '../shopping-lists/shopping-lists.service';
import { NutritionAnalyticsService } from '../nutrition-analytics/nutrition-analytics.service';
import { NutritionService } from '../nutrition/nutrition.service';
import { WingmanOnboardingService } from './onboarding/wingman-onboarding.service';
import { ActivityRecordDto } from '../profile/dto/activity-record.dto';
import { MetricRecordDto } from '../profile/dto/metric-record.dto';
import type { AssistantUiBlock } from './assistant-ui.types';
import type { AssistantReadinessReport } from './assistant.types';
import type { ConfirmAssistantActionDto } from './dto/confirm-action.dto';
import type { PatchAssistantThreadDto } from './dto/patch-thread.dto';

@Injectable()
export class AssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly openai: OpenAiClientService,
    private readonly assistantLlm: AssistantLlmService,
    private readonly wingman: AssistantWingmanService,
    private readonly profile: ProfileService,
    private readonly mealPlans: MealPlansService,
    private readonly shoppingLists: ShoppingListsService,
    private readonly nutritionAnalytics: NutritionAnalyticsService,
    private readonly nutrition: NutritionService,
    private readonly onboarding: WingmanOnboardingService,
    private readonly threadSummary: ThreadSummaryService,
    private readonly userMemory: UserMemoryService,
  ) {}

  getUserMemory(userId: string) {
    return this.userMemory.getForUser(userId);
  }

  clearUserMemory(userId: string) {
    return this.userMemory.clearForUser(userId);
  }

  /** Whether wingman chat is enabled (`ASSISTANT_ENABLED` !== `false`). */
  chatEnabled(): boolean {
    const flag = this.config.get<string>('ASSISTANT_ENABLED');
    return flag !== 'false';
  }

  async getReadinessReport(): Promise<AssistantReadinessReport> {
    const assistantTables = await this.hasAssistantTables();
    const wingmanChat = this.assistantLlm.wingmanChatConfigured();

    return {
      enabled: this.chatEnabled(),
      providers: {
        openAi: Boolean(this.openai.apiKey),
        anthropic: wingmanChat,
        gemini: Boolean(this.config.get<string>('GEMINI_API_KEY')?.trim()),
      },
      database: { assistantTables },
    };
  }

  async createThread(
    userId: string,
    title?: string,
    coachingMode?: 'balanced' | 'nutrition' | 'wellness' | 'onboarding',
  ) {
    return this.prisma.assistantThread.create({
      data: {
        userId,
        title: title?.trim() || null,
        coachingMode: coachingMode ?? 'balanced',
      },
      select: {
        id: true,
        title: true,
        coachingMode: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  getOnboarding(userId: string) {
    return this.onboarding.getStatus(userId);
  }

  skipOnboarding(userId: string) {
    return this.onboarding.skip(userId);
  }

  async listThreads(userId: string) {
    const rows = await this.prisma.assistantThread.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, role: true, createdAt: true },
        },
      },
    });
    return rows.map((t) => ({
      id: t.id,
      title: t.title,
      updatedAt: t.updatedAt,
      preview: t.messages[0]?.content?.slice(0, 120) ?? null,
    }));
  }

  async getThread(userId: string, threadId: string) {
    const thread = await this.prisma.assistantThread.findFirst({
      where: { id: threadId, userId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    return {
      id: thread.id,
      title: thread.title,
      summary: thread.summary,
      coachingMode: thread.coachingMode ?? 'balanced',
      messages: thread.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        uiBlocks: m.uiBlocks,
        toolTraces: m.toolTraces,
        createdAt: m.createdAt,
      })),
    };
  }

  async deleteThread(userId: string, threadId: string) {
    const thread = await this.prisma.assistantThread.findFirst({
      where: { id: threadId, userId },
      select: { id: true },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    await this.prisma.assistantThread.delete({ where: { id: threadId } });
    return { ok: true };
  }

  async getNudges(userId: string) {
    const status = await this.reminderStatus(userId);
    const lines: string[] = [
      'Hi — I’m your wellness wingman. I can nudge you to log weight or activities, and help record them when you ask (with your confirmation).',
    ];
    const uiBlocks: AssistantUiBlock[] = [];

    if (status.weightDue) {
      lines.push(
        'Would you like to record your weekly weight now? Tell me your weight in kg, or open the Weight & activity tab.',
      );
      uiBlocks.push({
        type: 'cta',
        label: 'Open Weight & activity tab',
        action: 'open_record',
        payload: { focus: 'weight' },
      });
    }
    if (status.activityDue) {
      lines.push(
        'Would you like to log an activity now? For example: “record 1 hour tennis for today”.',
      );
      uiBlocks.push({
        type: 'cta',
        label: 'Open Weight & activity tab',
        action: 'open_record',
        payload: { focus: 'activity' },
      });
    }

    if (status.weeklyCheckIn) {
      lines.push(
        'Weekly check-in: how are energy, sleep, and movement this week? You can ask about progress, log weight, or review your meal plan.',
      );
      uiBlocks.push({
        type: 'cta',
        label: 'View Insights',
        action: 'open_insights',
      });
    }

    if (status.proteinLowStreak) {
      lines.push(
        `You've been under your protein target for ${status.proteinLowStreak} days in a row. Want a high-protein meal idea or to adjust your target?`,
      );
      uiBlocks.push({
        type: 'cta',
        label: 'Open Nutrition tab',
        action: 'open_nutrition',
      });
    }

    if (status.checkInDue) {
      lines.push(
        'A quick daily check-in (sleep, water, mood) helps your wellness picture — open Overview to log it.',
      );
      uiBlocks.push({
        type: 'cta',
        label: 'Open Overview',
        action: 'open_record',
        payload: { focus: 'overview' },
      });
    }

    return { lines, uiBlocks, status };
  }

  async patchThread(
    userId: string,
    threadId: string,
    dto: PatchAssistantThreadDto,
  ) {
    const thread = await this.prisma.assistantThread.findFirst({
      where: { id: threadId, userId },
      select: { id: true },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    if (!dto.coachingMode) {
      throw new BadRequestException('No fields to update');
    }
    return this.prisma.assistantThread.update({
      where: { id: threadId },
      data: { coachingMode: dto.coachingMode },
      select: {
        id: true,
        title: true,
        coachingMode: true,
        updatedAt: true,
      },
    });
  }

  async handleUserMessage(
    userId: string,
    threadId: string,
    content: string,
    coachingMode?: 'balanced' | 'nutrition' | 'wellness' | 'onboarding',
  ) {
    if (!this.chatEnabled()) {
      throw new BadRequestException(
        'Wingman chat is disabled (ASSISTANT_ENABLED=false).',
      );
    }

    if (coachingMode) {
      await this.prisma.assistantThread.updateMany({
        where: { id: threadId, userId },
        data: { coachingMode },
      });
    }

    await this.persistUserMessage(userId, threadId, content);
    const reply = await this.wingman.generateReply(
      userId,
      threadId,
      content.trim(),
    );
    const saved = await this.persistAssistantMessage(
      threadId,
      reply.content,
      reply.uiBlocks,
      reply.toolTraces,
    );
    void this.threadSummary.maybeUpdate(threadId);
    void this.userMemory.maybeConsolidate(userId);
    return saved;
  }

  async *handleUserMessageStream(
    userId: string,
    threadId: string,
    content: string,
    coachingMode?: 'balanced' | 'nutrition' | 'wellness' | 'onboarding',
  ): AsyncGenerator<WingmanStreamEvent & { messageId?: string }> {
    if (!this.chatEnabled()) {
      yield {
        type: 'error',
        message: 'Wingman chat is disabled (ASSISTANT_ENABLED=false).',
      };
      return;
    }

    if (coachingMode) {
      await this.prisma.assistantThread.updateMany({
        where: { id: threadId, userId },
        data: { coachingMode },
      });
    }

    await this.persistUserMessage(userId, threadId, content);

    if (!this.wingman.streamingEnabled()) {
      const reply = await this.wingman.generateReply(
        userId,
        threadId,
        content.trim(),
      );
      const saved = await this.persistAssistantMessage(
        threadId,
        reply.content,
        reply.uiBlocks,
        reply.toolTraces,
      );
      void this.threadSummary.maybeUpdate(threadId);
      void this.userMemory.maybeConsolidate(userId);
      yield {
        type: 'done',
        content: saved.content,
        uiBlocks: saved.uiBlocks as AssistantUiBlock[] | undefined,
        toolTraces: saved.toolTraces as Array<{
          name: string;
          args: unknown;
          resultSummary: string;
        }>,
        messageId: saved.id,
      };
      return;
    }

    for await (const event of this.wingman.generateReplyStream(
      userId,
      threadId,
      content.trim(),
    )) {
      if (event.type !== 'done') {
        yield event;
        continue;
      }

      const saved = await this.persistAssistantMessage(
        threadId,
        event.content,
        event.uiBlocks as AssistantUiBlock[] | undefined,
        event.toolTraces,
      );
      void this.threadSummary.maybeUpdate(threadId);
      void this.userMemory.maybeConsolidate(userId);
      yield {
        type: 'done',
        content: saved.content,
        uiBlocks: saved.uiBlocks as AssistantUiBlock[] | undefined,
        toolTraces: saved.toolTraces as Array<{
          name: string;
          args: unknown;
          resultSummary: string;
        }>,
        messageId: saved.id,
      };
    }
  }

  async confirmAction(userId: string, dto: ConfirmAssistantActionDto) {
    if (dto.action === 'confirm_log_activity') {
      const activityType =
        typeof dto.payload.activityType === 'string'
          ? dto.payload.activityType
          : '';
      const durationMinutes = Number(dto.payload.durationMinutes);
      if (!activityType || !Number.isFinite(durationMinutes)) {
        throw new BadRequestException('Invalid activity payload');
      }
      const body: ActivityRecordDto = {
        activityType,
        durationMinutes,
        activityAt:
          typeof dto.payload.activityAt === 'string'
            ? dto.payload.activityAt
            : undefined,
        notes:
          typeof dto.payload.notes === 'string' ? dto.payload.notes : undefined,
      };
      const result = await this.profile.recordActivity(userId, body);
      return {
        ok: true,
        action: dto.action,
        result,
        message: `Logged ${result.activity.activityTypeLabel} (${result.activity.durationMinutes} min).`,
      };
    }

    if (dto.action === 'confirm_log_weight') {
      const weightKg = Number(dto.payload.weightKg);
      if (!Number.isFinite(weightKg)) {
        throw new BadRequestException('Invalid weight payload');
      }
      const body: MetricRecordDto = {
        weightKg,
        recordedAt:
          typeof dto.payload.recordedAt === 'string'
            ? dto.payload.recordedAt
            : undefined,
        source: 'wingman',
      };
      const result = await this.profile.recordMetric(userId, body);
      return {
        ok: true,
        action: dto.action,
        result,
        message: `Recorded weight ${weightKg} kg.`,
      };
    }

    if (dto.action === 'confirm_regenerate_meal') {
      const versionId =
        typeof dto.payload.versionId === 'string' ? dto.payload.versionId : '';
      const mealId =
        typeof dto.payload.mealId === 'string' ? dto.payload.mealId : '';
      if (!versionId || !mealId) {
        throw new BadRequestException('Invalid meal regenerate payload');
      }
      const updated = await this.mealPlans.regenerateMeal(
        versionId,
        userId,
        mealId,
      );
      const mealTitle =
        typeof dto.payload.mealTitle === 'string'
          ? dto.payload.mealTitle
          : 'meal';
      const newMeal = updated.meals.find((m) => m.id === mealId);
      return {
        ok: true,
        action: dto.action,
        result: updated,
        message: newMeal
          ? `Regenerated ${mealTitle} → ${newMeal.title}. Open Nutrition to review.`
          : `Regenerated ${mealTitle}. Open Nutrition to review.`,
        uiBlocks: [
          {
            type: 'cta' as const,
            label: 'Open Nutrition tab',
            action: 'open_nutrition' as const,
          },
        ],
      };
    }

    if (dto.action === 'confirm_mark_meal_eaten') {
      const versionId =
        typeof dto.payload.versionId === 'string' ? dto.payload.versionId : '';
      const mealId =
        typeof dto.payload.mealId === 'string' ? dto.payload.mealId : '';
      if (!versionId || !mealId) {
        throw new BadRequestException('Invalid mark meal eaten payload');
      }
      const result = await this.mealPlans.logMealEaten(
        versionId,
        userId,
        mealId,
      );
      const mealTitle =
        typeof dto.payload.mealTitle === 'string'
          ? dto.payload.mealTitle
          : 'meal';
      return {
        ok: true,
        action: dto.action,
        result,
        message: `Marked ${mealTitle} as eaten — added to today's intake.`,
        uiBlocks: [
          {
            type: 'cta' as const,
            label: 'Open Nutrition tab',
            action: 'open_nutrition' as const,
          },
        ],
      };
    }

    if (dto.action === 'confirm_generate_meal_plan') {
      const startDate =
        typeof dto.payload.startDate === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(dto.payload.startDate)
          ? dto.payload.startDate
          : new Date().toISOString().slice(0, 10);
      const duration =
        dto.payload.duration === 'weekly' ? 'weekly' : 'daily';
      const plan = await this.mealPlans.generate(userId, {
        startDate,
        duration,
      });
      return {
        ok: true,
        action: dto.action,
        result: plan,
        message: `Generated ${duration} meal plan starting ${startDate}. Open Nutrition to review.`,
        uiBlocks: [
          {
            type: 'cta' as const,
            label: 'Open Nutrition tab',
            action: 'open_nutrition' as const,
          },
        ],
      };
    }

    if (dto.action === 'confirm_onboarding_skip') {
      await this.onboarding.skip(userId);
      return {
        ok: true,
        action: dto.action,
        message:
          'Setup skipped. You can finish your profile anytime in Profile, Nutrition, or by asking me here.',
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

    if (dto.action === 'confirm_onboarding_ai_targets') {
      const row = await this.nutrition.applyAiSuggestedTargets(userId);
      const next = await this.onboarding.getStatus(userId);
      const macros = row.macroTargets as {
        protein?: number;
        carbs?: number;
        fats?: number;
      } | null;
      return {
        ok: true,
        action: dto.action,
        result: row,
        message: `Saved AI targets: ${row.calorieTarget} kcal${
          macros?.protein != null
            ? ` · P ${macros.protein}g C ${macros.carbs}g F ${macros.fats}g`
            : ''
        }.\n\n${next.opener.content}`,
        uiBlocks: next.opener.uiBlocks,
      };
    }

    if (dto.action === 'confirm_onboarding_formula_targets') {
      const row = await this.nutrition.applySuggestedTargets(userId);
      const next = await this.onboarding.getStatus(userId);
      const macros = row.macroTargets as {
        protein?: number;
        carbs?: number;
        fats?: number;
      } | null;
      return {
        ok: true,
        action: dto.action,
        result: row,
        message: `Saved formula targets: ${row.calorieTarget} kcal${
          macros?.protein != null
            ? ` · P ${macros.protein}g C ${macros.carbs}g F ${macros.fats}g`
            : ''
        }.\n\n${next.opener.content}`,
        uiBlocks: next.opener.uiBlocks,
      };
    }

    if (dto.action === 'confirm_onboarding_meal_defaults') {
      const done = await this.onboarding.applyMealDefaults(userId);
      return {
        ok: true,
        action: dto.action,
        message: done.message,
        uiBlocks: done.uiBlocks,
      };
    }

    if (dto.action === 'confirm_generate_shopping_list') {
      const versionId =
        typeof dto.payload.versionId === 'string' ? dto.payload.versionId : '';
      if (!versionId) {
        throw new BadRequestException('Invalid shopping list payload');
      }
      const list = await this.shoppingLists.generateFromVersion(
        userId,
        versionId,
        'Wingman shopping list',
      );
      return {
        ok: true,
        action: dto.action,
        result: list,
        message: `Shopping list created (${list.items?.length ?? 0} items).`,
        uiBlocks: [
          {
            type: 'cta' as const,
            label: 'Open shopping list',
            action: 'open_nutrition' as const,
            payload: { focus: 'shopping', shoppingListId: list.id },
          },
        ],
      };
    }

    throw new BadRequestException('Unknown action');
  }

  private async persistAssistantMessage(
    threadId: string,
    content: string,
    uiBlocks?: AssistantUiBlock[],
    toolTraces?: Array<{
      name: string;
      args: unknown;
      resultSummary: string;
    }>,
  ) {
    const row = await this.prisma.assistantMessage.create({
      data: {
        threadId,
        role: 'assistant',
        content,
        uiBlocks: uiBlocks?.length
          ? (uiBlocks as unknown as Prisma.InputJsonValue)
          : undefined,
        toolTraces: toolTraces?.length
          ? (toolTraces as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });
    await this.prisma.assistantThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });
    return {
      id: row.id,
      role: 'assistant' as const,
      content: row.content,
      uiBlocks: row.uiBlocks ?? undefined,
      toolTraces: row.toolTraces ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async persistUserMessage(
    userId: string,
    threadId: string,
    content: string,
  ) {
    const thread = await this.prisma.assistantThread.findFirst({
      where: { id: threadId, userId },
      select: { id: true },
    });
    if (!thread) throw new NotFoundException('Thread not found');

    const message = await this.prisma.assistantMessage.create({
      data: {
        threadId,
        role: 'user',
        content: content.trim(),
      },
    });
    await this.prisma.assistantThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });
    return message;
  }

  private async reminderStatus(userId: string) {
    const [metrics, activities, proteinLowStreak, checkInDue] =
      await Promise.all([
      this.profile.listMetrics(userId, 30, 1),
      this.profile.listActivities(userId, 7, 1),
      this.countLowProteinDays(userId, 3),
      this.checkInMissingToday(userId),
    ]);
    const weightAt = metrics[0]?.recordedAt
      ? new Date(metrics[0].recordedAt as string | Date)
      : null;
    const activityAt = activities[0]?.activityAt
      ? new Date(activities[0].activityAt as string | Date)
      : null;
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const dayMs = 24 * 60 * 60 * 1000;
    const weightDue = !weightAt || Date.now() - weightAt.getTime() >= weekMs;
    const activityDue =
      !activityAt || Date.now() - activityAt.getTime() >= dayMs;
    const fiveDays = 5 * dayMs;
    const staleProfile =
      (!weightAt || Date.now() - weightAt.getTime() >= fiveDays) &&
      (!activityAt || Date.now() - activityAt.getTime() >= fiveDays);
    const weeklyCheckIn = staleProfile && !weightDue && !activityDue;
    return {
      weightDue,
      activityDue,
      weeklyCheckIn,
      proteinLowStreak:
        proteinLowStreak >= 3 ? proteinLowStreak : null,
      checkInDue,
    };
  }

  private async countLowProteinDays(
    userId: string,
    days: number,
  ): Promise<number> {
    let streak = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const date = d.toISOString().slice(0, 10);
      const daily = await this.nutritionAnalytics.dailySummary(userId, date);
      if (daily.macroPercentOfTarget.protein < 90 && daily.intake.protein > 0) {
        streak++;
      } else if (i === 0 && daily.intake.protein === 0) {
        continue;
      } else {
        break;
      }
    }
    return streak;
  }

  private async checkInMissingToday(userId: string): Promise<boolean> {
    const today = new Date().toISOString().slice(0, 10);
    const row = await this.prisma.dailyCheckIn.findFirst({
      where: {
        userId,
        date: today,
        OR: [
          { sleepHours: { not: null } },
          { waterGlasses: { not: null } },
          { mood: { not: null } },
        ],
      },
    });
    return !row;
  }

  private async hasAssistantTables(): Promise<boolean> {
    try {
      await this.prisma.assistantThread.count();
      return true;
    } catch {
      return false;
    }
  }

}
