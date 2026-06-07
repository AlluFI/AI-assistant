import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WingmanLlmFacade } from '../ai/llm/wingman-llm.facade';
import type { WingmanStreamEvent } from '../ai/llm/wingman-stream.types';
import { AssistantToolsService } from './assistant-tools.service';
import { UserMemoryService } from './user-memory.service';
import {
  chartUiBlocksFromToolTraces,
  inferChartToolCall,
} from './chart-ui-blocks.util';
import {
  inferPlannedMealSlotToolCall,
  isPlannedMealNutrientsQuestion,
  normalizeRecipeToolArgs,
} from './meal-recipe-infer.util';
import {
  formatPlannedMealNutrientsReply,
  mealTypeLabel,
} from './planned-meal-nutrients.util';
import {
  inferMealPlanWeekScope,
  normalizeMealPlanToolArgs,
} from './meal-plan-infer.util';
import {
  mergeWeeklyMealPlanReply,
  weekMealPlanFromTraces,
  weekdayForDate,
} from './weekly-meal-plan-format.util';
import { buildWingmanSystemPrompt } from './prompts/system-prompt';
import {
  parseGenerateMealPlanIntent,
  parseLogActivityIntent,
  parseLogWeightIntent,
  parseMarkMealEatenIntent,
  parseRegenerateMealIntent,
  parseShoppingListIntent,
} from './wingman-intent';
import type { WingmanCoachingMode } from './prompts/coaching-mode';
import type { AssistantUiBlock } from './assistant-ui.types';
import { WingmanOnboardingService } from './onboarding/wingman-onboarding.service';

const MEDICAL_URGENT =
  /chest\s+pain|heart\s+attack|stroke|can't\s+breathe|cannot\s+breathe|severe\s+pain|fainting|passed\s+out/i;

@Injectable()
export class AssistantWingmanService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tools: AssistantToolsService,
    private readonly llm: WingmanLlmFacade,
    private readonly userMemory: UserMemoryService,
    private readonly onboarding: WingmanOnboardingService,
  ) {}

  llmAvailable(): boolean {
    return this.llm.isConfigured();
  }

  streamingEnabled(): boolean {
    return this.llm.streamingEnabled();
  }

  async generateReply(
    userId: string,
    threadId: string,
    userMessage: string,
  ): Promise<{
    content: string;
    uiBlocks?: AssistantUiBlock[];
    toolTraces?: Array<{
      name: string;
      args: unknown;
      resultSummary: string;
    }>;
  }> {
    const obStatus = await this.onboarding.getStatus(userId);

    if (MEDICAL_URGENT.test(userMessage)) {
      return {
        content:
          'Chest pain or serious symptoms during exercise need urgent medical attention. Please contact emergency services or your doctor now. I cannot diagnose or treat medical conditions.',
      };
    }

    if (obStatus.active) {
      const obReply = await this.onboarding.handleMessage(userId, userMessage);
      if (obReply) return obReply;
    } else {
      const staticReply = await this.tryStaticReply(userId, userMessage);
      if (staticReply) return staticReply;
    }

    if (!this.llmAvailable()) {
      return {
        content:
          'I need an AI provider key to answer data questions. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in the API environment. You can still log activities or weight with phrases like "record 1 hour tennis for today".',
      };
    }

    const ctx = await this.buildLlmContext(userId, threadId, obStatus);

    const traceResults: Array<{
      name: string;
      args: Record<string, unknown>;
      result: unknown;
      resultSummary: string;
    }> = [];

    const executeTool = (name: string, args: Record<string, unknown>) =>
      this.executeWingmanTool(userId, userMessage, name, args, traceResults);

    const result = await this.llm.chat({
      system: ctx.system,
      history: ctx.history,
      userMessage,
      executeTool,
    });

    await this.applyInferredChartTool(userMessage, traceResults, executeTool);
    await this.applyInferredMealPlanWeekScope(userMessage, userId, traceResults);
    await this.applyInferredRecipeTool(userMessage, traceResults, executeTool);

    return this.packageLlmReply(userMessage, result.content, traceResults);
  }

  async *generateReplyStream(
    userId: string,
    threadId: string,
    userMessage: string,
  ): AsyncGenerator<WingmanStreamEvent> {
    const obStatus = await this.onboarding.getStatus(userId);

    if (MEDICAL_URGENT.test(userMessage)) {
      yield {
        type: 'done',
        content:
          'Chest pain or serious symptoms during exercise need urgent medical attention. Please contact emergency services or your doctor now. I cannot diagnose or treat medical conditions.',
      };
      return;
    }

    if (obStatus.active) {
      const obReply = await this.onboarding.handleMessage(userId, userMessage);
      if (obReply) {
        yield {
          type: 'done',
          content: obReply.content,
          uiBlocks: obReply.uiBlocks,
        };
        return;
      }
    } else {
      const staticReply = await this.tryStaticReply(userId, userMessage);
      if (staticReply) {
        yield {
          type: 'done',
          content: staticReply.content,
          uiBlocks: staticReply.uiBlocks,
        };
        return;
      }
    }

    if (!this.llmAvailable()) {
      yield {
        type: 'done',
        content:
          'I need an AI provider key to answer data questions. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in the API environment. You can still log activities or weight with phrases like "record 1 hour tennis for today".',
      };
      return;
    }

    const ctx = await this.buildLlmContext(userId, threadId, obStatus);
    const traceResults: Array<{
      name: string;
      args: Record<string, unknown>;
      result: unknown;
      resultSummary: string;
    }> = [];

    const executeTool = (name: string, args: Record<string, unknown>) =>
      this.executeWingmanTool(userId, userMessage, name, args, traceResults);

    let finalContent = '';

    for await (const event of this.llm.chatStream({
      system: ctx.system,
      history: ctx.history,
      userMessage,
      executeTool,
    })) {
      if (event.type === 'token') {
        finalContent += event.text;
        yield event;
      } else if (event.type === 'tool_start' || event.type === 'tool_end') {
        yield event;
      } else if (event.type === 'done') {
        finalContent = event.content || finalContent;
      } else if (event.type === 'error') {
        yield event;
        return;
      }
    }

    yield* this.applyInferredChartToolStream(
      userMessage,
      traceResults,
      executeTool,
    );
    yield* this.applyInferredMealPlanWeekScopeStream(
      userMessage,
      userId,
      traceResults,
    );
    yield* this.applyInferredRecipeToolStream(
      userMessage,
      traceResults,
      executeTool,
    );

    const packaged = this.packageLlmReply(
      userMessage,
      finalContent,
      traceResults,
    );
    yield {
      type: 'done',
      content: packaged.content,
      uiBlocks: packaged.uiBlocks,
      toolTraces: packaged.toolTraces,
    };
  }

  private packageLlmReply(
    userMessage: string,
    content: string,
    traceResults: Array<{
      name: string;
      args: Record<string, unknown>;
      result: unknown;
      resultSummary: string;
    }>,
  ) {
    const chartBlocks = chartUiBlocksFromToolTraces(traceResults);
    const uiBlocks: AssistantUiBlock[] = [...chartBlocks];

    const weekPlan = weekMealPlanFromTraces(traceResults);
    if (inferMealPlanWeekScope(userMessage) && weekPlan) {
      content = mergeWeeklyMealPlanReply(content, weekPlan);
    }

    if (
      /protein|macro|calorie|weight trend|chart|visual/i.test(userMessage) &&
      chartBlocks.length === 0 &&
      traceResults.some((t) => t.name === 'get_nutrition_summary')
    ) {
      uiBlocks.push({
        type: 'hint',
        text: 'Would you like a chart? Try: "Show my weight trend for the last month" or "Show protein vs target".',
      });
    }

    return {
      content,
      uiBlocks: uiBlocks.length ? uiBlocks : undefined,
      toolTraces: traceResults.map((t) => ({
        name: t.name,
        args: t.args,
        resultSummary: t.resultSummary,
      })),
    };
  }

  private async buildLlmContext(
    userId: string,
    threadId: string,
    obStatus?: Awaited<ReturnType<WingmanOnboardingService['getStatus']>>,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });
    const threadRow = await this.prisma.assistantThread.findFirst({
      where: { id: threadId, userId },
      select: { summary: true, coachingMode: true },
    });

    const mode =
      this.config.get<string>('ASSISTANT_RESPONSE_MODE') === 'detailed'
        ? 'detailed'
        : 'concise';
    let coachingMode = this.normalizeCoachingMode(threadRow?.coachingMode);
    if (obStatus?.active) {
      coachingMode = 'onboarding';
    }

    let system = buildWingmanSystemPrompt({
      displayName: user?.displayName ?? null,
      responseMode: mode,
      coachingMode,
    });
    if (obStatus?.active) {
      system += this.onboarding.formatOnboardingContext(obStatus.step);
    }
    if (threadRow?.summary?.trim()) {
      system += `\n\n## Thread memory (this conversation)\n${threadRow.summary.trim()}`;
    }

    const longTerm = this.userMemory.formatForPrompt(
      await this.userMemory.getForUser(userId),
    );
    if (longTerm) {
      system += `\n\n## Long-term memory (across all chats — use only when relevant to this question; do not recite in every reply)\n${longTerm}`;
    }

    const prior = await this.prisma.assistantMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
      take: 12,
    });
    const history = prior
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    return { system, history };
  }

  private async tryStaticReply(
    userId: string,
    userMessage: string,
  ): Promise<{ content: string; uiBlocks?: AssistantUiBlock[] } | null> {
    if (MEDICAL_URGENT.test(userMessage)) {
      return {
        content:
          'Chest pain or serious symptoms during exercise need urgent medical attention. Please contact emergency services or your doctor now. I cannot diagnose or treat medical conditions.',
      };
    }

    const mealSlot = inferPlannedMealSlotToolCall(userMessage);
    if (mealSlot && isPlannedMealNutrientsQuestion(userMessage)) {
      const plan = (await this.tools.execute(userId, 'get_meal_plan', {
        date: mealSlot.date,
      })) as {
        error?: string;
        meals?: Array<{
          mealType: string;
          title: string;
          calories: number | null;
          protein: number | null;
          carbs: number | null;
          fats: number | null;
          recipeLinked?: boolean;
        }>;
      };
      if (plan.error) {
        return {
          content:
            'Create or activate a meal plan in the Nutrition tab first, then I can read breakfast, lunch, or dinner macros from your plan.',
          uiBlocks: [
            { type: 'cta', label: 'Open Nutrition tab', action: 'open_nutrition' },
          ],
        };
      }
      const meal = plan.meals?.find((m) => m.mealType === mealSlot.meal_type);
      if (!meal) {
        return {
          content: `I don't see **${mealTypeLabel(mealSlot.meal_type).toLowerCase()}** on your plan for ${mealSlot.date}.`,
        };
      }
      return {
        content: formatPlannedMealNutrientsReply(
          mealTypeLabel(mealSlot.meal_type),
          mealSlot.date,
          meal,
        ),
      };
    }

    const markEaten = parseMarkMealEatenIntent(userMessage);
    if (markEaten) {
      const today = new Date().toISOString().slice(0, 10);
      const plan = (await this.tools.execute(userId, 'get_meal_plan', {
        date: today,
      })) as {
        error?: string;
        versionId?: string;
        meals?: Array<{
          id: string;
          mealType: string;
          title: string;
        }>;
      };
      if (plan.error || !plan.versionId) {
        return {
          content:
            'Create a meal plan in the Nutrition tab first, then I can mark meals as eaten.',
          uiBlocks: [
            { type: 'cta', label: 'Open Nutrition tab', action: 'open_nutrition' },
          ],
        };
      }
      const meal = plan.meals?.find((m) => m.mealType === markEaten.mealType);
      if (!meal) {
        return {
          content: `I don't see ${markEaten.mealTypeLabel.toLowerCase()} on today's plan.`,
        };
      }
      return {
        content: `I can mark **${markEaten.mealTypeLabel}** (${meal.title}) as eaten. Confirm to add it to today's intake.`,
        uiBlocks: [
          {
            type: 'cta',
            label: `Confirm: Mark ${markEaten.mealTypeLabel} eaten`,
            action: 'confirm_mark_meal_eaten',
            payload: {
              versionId: plan.versionId,
              mealId: meal.id,
              mealTitle: meal.title,
            },
          },
        ],
      };
    }

    const regenerate = parseRegenerateMealIntent(userMessage);
    if (regenerate) {
      const today = new Date().toISOString().slice(0, 10);
      const plan = (await this.tools.execute(userId, 'get_meal_plan', {
        date: today,
      })) as {
        error?: string;
        versionId?: string;
        meals?: Array<{
          id: string;
          mealType: string;
          title: string;
        }>;
      };
      if (plan.error || !plan.versionId) {
        return {
          content:
            plan.error === 'no_active_meal_plan'
              ? 'You do not have an active meal plan yet. Create one in the Nutrition tab first.'
              : 'I could not find your meal plan. Open the Nutrition tab to set one up.',
          uiBlocks: [
            {
              type: 'cta',
              label: 'Open Nutrition tab',
              action: 'open_nutrition',
            },
          ],
        };
      }
      const meal = plan.meals?.find((m) => m.mealType === regenerate.mealType);
      if (!meal) {
        return {
          content: `I don't see a ${regenerate.mealTypeLabel.toLowerCase()} slot on today's plan.`,
        };
      }
      return {
        content: `I can regenerate **${regenerate.mealTypeLabel}** (${meal.title}). Tap confirm — your plan updates only after you approve.`,
        uiBlocks: [
          {
            type: 'cta',
            label: `Confirm: Regenerate ${regenerate.mealTypeLabel}`,
            action: 'confirm_regenerate_meal',
            payload: {
              versionId: plan.versionId,
              mealId: meal.id,
              mealTitle: meal.title,
              mealType: regenerate.mealType,
            },
          },
        ],
      };
    }

    if (parseShoppingListIntent(userMessage)) {
      const plan = (await this.tools.execute(userId, 'get_meal_plan', {
        date: new Date().toISOString().slice(0, 10),
      })) as { error?: string; versionId?: string };
      if (plan.error || !plan.versionId) {
        return {
          content:
            'Create a meal plan in the Nutrition tab first, then I can build a shopping list from it.',
          uiBlocks: [
            {
              type: 'cta',
              label: 'Open Nutrition tab',
              action: 'open_nutrition',
            },
          ],
        };
      }
      return {
        content:
          'I can generate a shopping list from your active meal plan (all confirmed recipes). Confirm to create it.',
        uiBlocks: [
          {
            type: 'cta',
            label: 'Confirm: Create shopping list',
            action: 'confirm_generate_shopping_list',
            payload: { versionId: plan.versionId },
          },
        ],
      };
    }

    const generatePlan = parseGenerateMealPlanIntent(userMessage);
    if (generatePlan) {
      return {
        content: `I can generate a **${generatePlan.duration}** meal plan starting ${generatePlan.startDate}. Confirm to create it (this may take a moment).`,
        uiBlocks: [
          {
            type: 'cta',
            label: `Confirm: Generate ${generatePlan.duration} plan`,
            action: 'confirm_generate_meal_plan',
            payload: {
              startDate: generatePlan.startDate,
              duration: generatePlan.duration,
            },
          },
        ],
      };
    }

    const activity = parseLogActivityIntent(userMessage);
    if (activity) {
      const when = activity.activityAt ? ` on ${activity.activityAt}` : '';
      return {
        content: `I can log ${activity.durationMinutes} minutes of ${activity.activityTypeLabel}${when}. Tap confirm — nothing is saved until you approve.`,
        uiBlocks: [
          {
            type: 'cta',
            label: `Confirm: ${activity.durationMinutes} min ${activity.activityTypeLabel}`,
            action: 'confirm_log_activity',
            payload: {
              activityType: activity.activityType,
              durationMinutes: activity.durationMinutes,
              activityAt: activity.activityAt,
            },
          },
        ],
      };
    }

    const weight = parseLogWeightIntent(userMessage);
    if (weight) {
      const when = weight.recordedAt ? ` on ${weight.recordedAt}` : '';
      return {
        content: `I can record ${weight.weightKg} kg${when}. Confirm to save.`,
        uiBlocks: [
          {
            type: 'cta',
            label: `Confirm: ${weight.weightKg} kg`,
            action: 'confirm_log_weight',
            payload: {
              weightKg: weight.weightKg,
              recordedAt: weight.recordedAt,
            },
          },
        ],
      };
    }

    if (/email|password|date of birth|\bdob\b/i.test(userMessage)) {
      return {
        content:
          "I can't access account email, passwords, or date of birth in this chat. Use the Account section of the app for those settings.",
      };
    }

    return null;
  }

  /** When the user asks for a chart but the model skips `get_chart_data`. */
  private async applyInferredChartTool(
    userMessage: string,
    traceResults: Array<{ name: string }>,
    executeTool: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<unknown>,
  ) {
    const inferredChart = inferChartToolCall(userMessage);
    if (
      !inferredChart ||
      traceResults.some((t) => t.name === 'get_chart_data')
    ) {
      return;
    }
    await executeTool('get_chart_data', {
      chart_type: inferredChart.chart_type,
      days: inferredChart.days ?? 30,
    });
  }

  private async *applyInferredChartToolStream(
    userMessage: string,
    traceResults: Array<{ name: string }>,
    executeTool: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<unknown>,
  ): AsyncGenerator<WingmanStreamEvent> {
    const inferredChart = inferChartToolCall(userMessage);
    if (
      !inferredChart ||
      traceResults.some((t) => t.name === 'get_chart_data')
    ) {
      return;
    }
    const args = {
      chart_type: inferredChart.chart_type,
      days: inferredChart.days ?? 30,
    };
    yield { type: 'tool_start', name: 'get_chart_data', args };
    const result = await executeTool('get_chart_data', args);
    yield {
      type: 'tool_end',
      name: 'get_chart_data',
      resultSummary: JSON.stringify(result).slice(0, 500),
    };
  }

  /** When the user asks for the weekly plan but the tool returned a single day. */
  private async applyInferredMealPlanWeekScope(
    userMessage: string,
    userId: string,
    traceResults: Array<{
      name: string;
      args: Record<string, unknown>;
      result: unknown;
      resultSummary: string;
    }>,
  ) {
    if (!inferMealPlanWeekScope(userMessage)) return;

    const idx = traceResults.findIndex((t) => t.name === 'get_meal_plan');
    if (idx === -1) {
      const args = { scope: 'week' };
      const result = await this.tools.execute(userId, 'get_meal_plan', args);
      traceResults.push({
        name: 'get_meal_plan',
        args,
        result,
        resultSummary: JSON.stringify(result).slice(0, 500),
      });
      return;
    }

    const prev = traceResults[idx].result as { scope?: string };
    if (prev?.scope === 'week') return;

    const args = { scope: 'week' };
    const result = await this.tools.execute(userId, 'get_meal_plan', args);
    traceResults[idx] = {
      name: 'get_meal_plan',
      args,
      result,
      resultSummary: JSON.stringify(result).slice(0, 500),
    };
  }

  private async *applyInferredMealPlanWeekScopeStream(
    userMessage: string,
    userId: string,
    traceResults: Array<{
      name: string;
      args: Record<string, unknown>;
      result: unknown;
      resultSummary: string;
    }>,
  ): AsyncGenerator<WingmanStreamEvent> {
    if (!inferMealPlanWeekScope(userMessage)) return;

    const idx = traceResults.findIndex((t) => t.name === 'get_meal_plan');
    const prev =
      idx >= 0 ? (traceResults[idx].result as { scope?: string }) : null;
    if (prev?.scope === 'week') return;

    const args = { scope: 'week' };
    yield { type: 'tool_start', name: 'get_meal_plan', args };
    const result = await this.tools.execute(userId, 'get_meal_plan', args);
    const entry = {
      name: 'get_meal_plan',
      args,
      result,
      resultSummary: JSON.stringify(result).slice(0, 500),
    };
    if (idx >= 0) {
      traceResults[idx] = entry;
    } else {
      traceResults.push(entry);
    }
    yield {
      type: 'tool_end',
      name: 'get_meal_plan',
      resultSummary: entry.resultSummary,
    };
  }

  private normalizeWingmanToolArgs(
    userMessage: string,
    name: string,
    args: Record<string, unknown>,
  ): Record<string, unknown> {
    if (name === 'get_meal_plan') {
      return normalizeMealPlanToolArgs(userMessage, args);
    }
    if (name === 'get_recipe') {
      return normalizeRecipeToolArgs(userMessage, args);
    }
    return args;
  }

  private async executeWingmanTool(
    userId: string,
    userMessage: string,
    name: string,
    args: Record<string, unknown>,
    traceResults: Array<{
      name: string;
      args: Record<string, unknown>;
      result: unknown;
      resultSummary: string;
    }>,
  ): Promise<unknown> {
    const normalizedArgs = this.normalizeWingmanToolArgs(
      userMessage,
      name,
      args,
    );
    try {
      const result = await this.tools.execute(userId, name, normalizedArgs);
      traceResults.push({
        name,
        args: normalizedArgs,
        result,
        resultSummary: JSON.stringify(result).slice(0, 500),
      });
      return result;
    } catch (e) {
      const message =
        e instanceof BadRequestException
          ? String(e.message)
          : e instanceof Error
            ? e.message
            : 'Tool failed';
      const errResult = { error: true, message };
      traceResults.push({
        name,
        args: normalizedArgs,
        result: errResult,
        resultSummary: JSON.stringify(errResult).slice(0, 500),
      });
      return errResult;
    }
  }

  /** When the user asks about a planned meal slot but skips tools or bad args. */
  private recipeToolSucceeded(
    traceResults: Array<{ name: string; result?: unknown }>,
  ): boolean {
    const row = traceResults.find((t) => t.name === 'get_recipe');
    if (!row) return false;
    const r = row.result as { error?: boolean } | undefined;
    return Boolean(r && !r.error);
  }

  private async applyInferredRecipeTool(
    userMessage: string,
    traceResults: Array<{ name: string; result?: unknown }>,
    executeTool: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<unknown>,
  ) {
    const inferred = inferPlannedMealSlotToolCall(userMessage);
    if (!inferred || this.recipeToolSucceeded(traceResults)) return;
    if (!traceResults.some((t) => t.name === 'get_meal_plan')) {
      await executeTool('get_meal_plan', { date: inferred.date });
    }
    await executeTool('get_recipe', {
      date: inferred.date,
      meal_type: inferred.meal_type,
    });
  }

  private async *applyInferredRecipeToolStream(
    userMessage: string,
    traceResults: Array<{ name: string; result?: unknown }>,
    executeTool: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<unknown>,
  ): AsyncGenerator<WingmanStreamEvent> {
    const inferred = inferPlannedMealSlotToolCall(userMessage);
    if (!inferred || this.recipeToolSucceeded(traceResults)) {
      return;
    }
    if (!traceResults.some((t) => t.name === 'get_meal_plan')) {
      const planArgs = { date: inferred.date };
      yield { type: 'tool_start', name: 'get_meal_plan', args: planArgs };
      const planResult = await executeTool('get_meal_plan', planArgs);
      yield {
        type: 'tool_end',
        name: 'get_meal_plan',
        resultSummary: JSON.stringify(planResult).slice(0, 500),
      };
    }
    const args = { date: inferred.date, meal_type: inferred.meal_type };
    yield { type: 'tool_start', name: 'get_recipe', args };
    const result = await executeTool('get_recipe', args);
    yield {
      type: 'tool_end',
      name: 'get_recipe',
      resultSummary: JSON.stringify(result).slice(0, 500),
    };
  }

  private normalizeCoachingMode(
    value: string | null | undefined,
  ): WingmanCoachingMode {
    if (
      value === 'nutrition' ||
      value === 'wellness' ||
      value === 'onboarding'
    ) {
      return value;
    }
    return 'balanced';
  }
}
