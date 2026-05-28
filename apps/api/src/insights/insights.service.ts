import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService, num } from '../analytics/analytics.service';

const PROMPT_VERSION = 'v1';

type InsightOutput = {
  summary: string;
  recommendations: Array<{
    title: string;
    detail: string;
    priority: 'high' | 'medium' | 'low';
  }>;
};

type InsightContext = {
  user_metrics: {
    restrictions?: unknown[];
    target_state?: { primaryGoal?: string | null };
    analytics?: { wellnessScore?: number; bmiClassification?: string | null };
    current_state?: { weeklyActivityDays?: number | null };
  };
};

@Injectable()
export class InsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly analytics: AnalyticsService,
  ) {}

  async list(userId: string, limit = 20) {
    const rows = await this.prisma.aIInsight.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, Math.max(1, limit)),
    });
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      provider: r.provider,
      model: r.model,
      degraded: r.degraded,
      summary: r.summary,
      recommendations: r.recommendations,
      createdAt: r.createdAt,
      errorMessage: r.errorMessage,
    }));
  }

  async generate(userId: string, historyDays = 30) {
    const privacy = await this.prisma.privacySettings.findUnique({
      where: { userId },
    });
    if (privacy && !privacy.allowAiProcessing) {
      const fallback = this.fallbackInsight(
        await this.buildContext(userId, historyDays),
      );
      const saved = await this.prisma.aIInsight.create({
        data: {
          userId,
          provider: 'none',
          model: 'privacy-blocked',
          promptVersion: PROMPT_VERSION,
          status: 'blocked',
          degraded: true,
          summary:
            'AI processing is disabled in your privacy settings. Generated a local fallback insight only.',
          recommendations: fallback.recommendations,
          contextJson: { reason: 'privacy_disabled' },
          errorMessage: 'AI processing disabled by user setting',
        },
      });
      return { insight: saved, fallback: true };
    }

    const context = await this.buildContext(userId, historyDays);
    const model = this.config.get<string>('AI_MODEL') ?? 'gpt-4o-mini';
    const apiKey = this.config.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      const cached = await this.latestCachedInsight(userId);
      const cachedRecommendations = this.normalizeStoredRecommendations(
        cached?.recommendations,
      );
      const fallback = cached
        ? {
            summary:
              'AI service unavailable; showing your most recent cached recommendations.',
            recommendations: cachedRecommendations,
          }
        : this.fallbackInsight(context);
      const saved = await this.prisma.aIInsight.create({
        data: {
          userId,
          provider: 'none',
          model: cached ? 'cached' : 'fallback',
          promptVersion: PROMPT_VERSION,
          status: cached ? 'cached_fallback' : 'fallback',
          degraded: true,
          summary: fallback.summary,
          recommendations: fallback.recommendations,
          contextJson: context,
          errorMessage: 'OPENAI_API_KEY not configured',
        },
      });
      return { insight: saved, fallback: true };
    }

    try {
      const ai = await this.callOpenAI(apiKey, model, context);
      const validated = this.validateRecommendationsAgainstRestrictions(
        context,
        ai,
      );
      const saved = await this.prisma.aIInsight.create({
        data: {
          userId,
          provider: 'openai',
          model,
          promptVersion: PROMPT_VERSION,
          status: 'ok',
          degraded: false,
          summary: validated.summary,
          recommendations: validated.recommendations,
          contextJson: context,
          rawResponse: ai as unknown as object,
        },
      });
      return { insight: saved, fallback: false };
    } catch (error) {
      const cached = await this.latestCachedInsight(userId);
      const cachedRecommendations = this.normalizeStoredRecommendations(
        cached?.recommendations,
      );
      const fallback = cached
        ? {
            summary:
              'AI service temporarily unavailable; showing your most recent cached recommendations.',
            recommendations: cachedRecommendations,
          }
        : this.fallbackInsight(context);
      const saved = await this.prisma.aIInsight.create({
        data: {
          userId,
          provider: 'openai',
          model,
          promptVersion: PROMPT_VERSION,
          status: cached ? 'cached_fallback' : 'fallback',
          degraded: true,
          summary: fallback.summary,
          recommendations: fallback.recommendations,
          contextJson: context,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown AI error',
        },
      });
      return { insight: saved, fallback: true };
    }
  }

  private async buildContext(userId: string, historyDays: number) {
    const profile = await this.prisma.healthProfile.findUnique({
      where: { userId },
    });
    const summary = await this.analytics.getSummary(userId);
    const weightSeries = await this.analytics.weightSeries(userId, historyDays);
    const wellnessSeries = await this.analytics.wellnessSeries(
      userId,
      historyDays,
    );
    const since = new Date(Date.now() - historyDays * 86400000);
    const [latest, recentActivities] = await Promise.all([
      this.prisma.healthMetricSnapshot.findFirst({
        where: { userId },
        orderBy: { recordedAt: 'desc' },
      }),
      this.prisma.activityLog.findMany({
        where: { userId, activityAt: { gte: since } },
        orderBy: { activityAt: 'desc' },
        take: 50,
        select: {
          activityType: true,
          activityAt: true,
          durationMinutes: true,
        },
      }),
    ]);

    const safeUserId = `u_${userId.slice(-8)}`;

    return {
      user_metrics: {
        user_id: safeUserId,
        current_state: {
          weightKg: latest?.weightKg ? num(latest.weightKg) : null,
          heightCm: latest?.heightCm ? num(latest.heightCm) : null,
          activityLevel: profile?.activityLevel ?? null,
          weeklyActivityDays:
            latest?.weeklyActivityDays ?? profile?.weeklyActivityDays ?? null,
        },
        target_state: {
          targetWeightKg: profile?.targetWeightKg
            ? num(profile.targetWeightKg)
            : null,
          desiredActivityLevel: profile?.desiredActivityLevel ?? null,
          primaryGoal: profile?.fitnessGoalPrimary ?? null,
        },
        preferences: Array.isArray(profile?.dietaryPreferences)
          ? profile.dietaryPreferences
          : [],
        restrictions: Array.isArray(profile?.dietaryRestrictions)
          ? profile.dietaryRestrictions
          : [],
        analytics: summary,
        progress: {
          weightSeries,
          wellnessSeries,
        },
        recentActivities: recentActivities.map((a) => ({
          activityType: a.activityType,
          activityAt: a.activityAt.toISOString(),
          durationMinutes: a.durationMinutes,
        })),
      },
      completeness: {
        hasProfile: Boolean(profile),
        hasMetrics: Boolean(latest),
        hasWeightHistory: weightSeries.length > 0,
        hasActivityLogs: recentActivities.length > 0,
      },
    };
  }

  private async callOpenAI(
    apiKey: string,
    model: string,
    context: unknown,
  ): Promise<InsightOutput> {
    const system =
      'You are a wellness coach assistant. Keep recommendations practical, non-medical, and safe. Return only strict JSON.';
    const user = {
      task: 'Generate weekly health insight summary and actionable recommendations.',
      output_format: {
        summary: 'string',
        recommendations: [
          {
            title: 'string',
            detail: 'string',
            priority: 'high | medium | low',
          },
        ],
      },
      constraints: [
        '2 to 4 recommendations only',
        'No diagnosis or treatment claims',
        'Reference given metrics and goals',
      ],
      context,
    };

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(user) },
        ],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`OpenAI error ${resp.status}: ${body.slice(0, 500)}`);
    }

    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('OpenAI returned no content');
    }
    const parsed = JSON.parse(text) as Partial<InsightOutput>;
    const summary =
      typeof parsed.summary === 'string' ? parsed.summary : 'No summary';
    const recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations
          .map((r) => ({
            title:
              typeof r?.title === 'string' ? r.title : 'Weekly recommendation',
            detail:
              typeof r?.detail === 'string'
                ? r.detail
                : 'Keep a consistent healthy routine this week.',
            priority:
              r?.priority === 'high' ||
              r?.priority === 'medium' ||
              r?.priority === 'low'
                ? r.priority
                : 'medium',
          }))
          .slice(0, 4)
      : [];

    return { summary, recommendations };
  }

  private fallbackInsight(context: {
    user_metrics: {
      analytics?: { wellnessScore?: number; bmiClassification?: string | null };
      current_state?: { weeklyActivityDays?: number | null };
      target_state?: { primaryGoal?: string | null };
    };
  }): InsightOutput {
    const score = context.user_metrics.analytics?.wellnessScore ?? 0;
    const bmiClass = context.user_metrics.analytics?.bmiClassification ?? null;
    const weekly = context.user_metrics.current_state?.weeklyActivityDays ?? 0;
    const goal = context.user_metrics.target_state?.primaryGoal ?? 'fitness';

    const recommendations: InsightOutput['recommendations'] = [];
    if (weekly < 3) {
      recommendations.push({
        title: 'Increase activity consistency',
        detail: 'Aim for at least 3 active days this week to build momentum.',
        priority: 'high',
      });
    }
    if (bmiClass === 'overweight' || bmiClass === 'obese') {
      recommendations.push({
        title: 'Use low-impact daily movement',
        detail:
          'Add 20-30 minutes of brisk walking most days to improve cardiovascular fitness.',
        priority: 'medium',
      });
    }
    recommendations.push({
      title: 'Goal alignment check',
      detail: `Review your current routine against your primary goal (${goal}) and make one specific adjustment for this week.`,
      priority: 'medium',
    });

    if (recommendations.length < 2) {
      recommendations.push({
        title: 'Sleep and hydration baseline',
        detail:
          'Target consistent sleep and hydration to support recovery and training quality.',
        priority: 'low',
      });
    }

    return {
      summary: `AI fallback insight: current wellness score is ${score}. Focus on consistent habits this week while improving gradually.`,
      recommendations: recommendations.slice(0, 4),
    };
  }

  private async latestCachedInsight(userId: string) {
    return this.prisma.aIInsight.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { recommendations: true },
    });
  }

  private validateRecommendationsAgainstRestrictions(
    context: unknown,
    insight: InsightOutput,
  ): InsightOutput {
    const typed = context as InsightContext;
    const restrictions = Array.isArray(typed?.user_metrics?.restrictions)
      ? typed.user_metrics.restrictions.map((r) => String(r).toLowerCase())
      : [];

    const blockedTerms = new Set<string>();
    for (const restriction of restrictions) {
      if (restriction.includes('dairy')) {
        ['dairy', 'milk', 'cheese', 'yogurt'].forEach((x) =>
          blockedTerms.add(x),
        );
      }
      if (restriction.includes('gluten')) {
        ['gluten', 'wheat', 'bread', 'pasta'].forEach((x) =>
          blockedTerms.add(x),
        );
      }
      if (restriction.includes('nut')) {
        ['nuts', 'peanut', 'almond', 'cashew'].forEach((x) =>
          blockedTerms.add(x),
        );
      }
    }
    if (!blockedTerms.size) return insight;

    const recommendations = insight.recommendations.filter((rec) => {
      const text = `${rec.title} ${rec.detail}`.toLowerCase();
      for (const term of blockedTerms) {
        if (text.includes(term)) return false;
      }
      return true;
    });

    if (recommendations.length) {
      return { ...insight, recommendations };
    }
    return {
      summary:
        'Generated recommendations were filtered due to dietary restrictions. Showing a safe baseline plan.',
      recommendations: [
        {
          title: 'Restriction-safe weekly plan',
          detail:
            'Focus on hydration, sleep consistency, and activity pacing aligned with your goal while keeping all recommendations restriction-safe.',
          priority: 'medium',
        },
      ],
    };
  }

  private normalizeStoredRecommendations(
    input: unknown,
  ): InsightOutput['recommendations'] {
    if (!Array.isArray(input)) return [];
    return input
      .map((r) => {
        const item = r as {
          title?: unknown;
          detail?: unknown;
          priority?: unknown;
        };
        const priority: 'high' | 'medium' | 'low' =
          item?.priority === 'high' ||
          item?.priority === 'medium' ||
          item?.priority === 'low'
            ? item.priority
            : 'medium';
        return {
          title:
            typeof item?.title === 'string'
              ? item.title
              : 'Weekly recommendation',
          detail:
            typeof item?.detail === 'string'
              ? item.detail
              : 'Keep your routine steady this week.',
          priority,
        };
      })
      .slice(0, 4);
  }
}
