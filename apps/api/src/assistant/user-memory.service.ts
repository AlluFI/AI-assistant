import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileService } from '../profile/profile.service';
import { WingmanLlmFacade } from '../ai/llm/wingman-llm.facade';
import {
  extractMemoryFactsFromMessages,
  mergeMemoryFacts,
  parseMemoryJson,
} from './user-memory-extract.util';
import type {
  AssistantMemoryFact,
  AssistantUserMemoryPayload,
} from './user-memory.types';

@Injectable()
export class UserMemoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly llm: WingmanLlmFacade,
    private readonly profile: ProfileService,
  ) {}

  memoryEnabled(): boolean {
    return this.config.get<string>('ASSISTANT_MEMORY_ENABLED') !== 'false';
  }

  async getForUser(userId: string): Promise<AssistantUserMemoryPayload> {
    const row = await this.prisma.assistantUserMemory.findUnique({
      where: { userId },
    });
    if (!row) {
      const seeded = await this.seedFromProfile(userId);
      return seeded ?? this.emptyPayload();
    }
    return this.serialize(row);
  }

  async clearForUser(userId: string) {
    await this.prisma.assistantUserMemory.deleteMany({ where: { userId } });
    return { ok: true };
  }

  formatForPrompt(payload: AssistantUserMemoryPayload): string | null {
    const parts: string[] = [];
    if (payload.narrative?.trim()) {
      parts.push(payload.narrative.trim());
    }
    for (const f of payload.facts) {
      parts.push(`- [${f.category}] ${f.text}`);
    }
    if (!parts.length) return null;
    return parts.join('\n').slice(0, 1200);
  }

  /** Update long-term memory after chat activity (async, throttled). */
  async maybeConsolidate(userId: string) {
    if (!this.memoryEnabled()) return;

    const row = await this.prisma.assistantUserMemory.findUnique({
      where: { userId },
      select: { updatedAt: true },
    });
    const since = row?.updatedAt ?? new Date(0);
    const minNew = Number(
      this.config.get<string>('ASSISTANT_MEMORY_MIN_NEW_MESSAGES') ?? 4,
    );
    const newUserMessages = await this.prisma.assistantMessage.count({
      where: {
        role: 'user',
        createdAt: { gt: since },
        thread: { userId },
      },
    });
    const hoursSince = (Date.now() - since.getTime()) / (1000 * 60 * 60);
    const forceByTime = hoursSince >= 24;

    if (!row && newUserMessages >= 2) {
      await this.consolidate(userId);
      return;
    }
    if (newUserMessages < minNew && !forceByTime) return;

    await this.consolidate(userId);
  }

  async consolidate(userId: string) {
    const existing = await this.getForUser(userId);

    const recentUserLines = await this.prisma.assistantMessage.findMany({
      where: { role: 'user', thread: { userId } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { content: true },
    });
    const userLines = recentUserLines.map((m) => m.content).reverse();

    const ruleFacts = extractMemoryFactsFromMessages(userLines);
    let narrative = existing.narrative;
    let facts = mergeMemoryFacts(existing.facts, ruleFacts);

    if (this.llm.isConfigured()) {
      const profileSnippet = await this.profileSnippet(userId);
      const llmRaw = await this.llm.consolidateUserMemory({
        existingNarrative: existing.narrative,
        existingFacts: existing.facts,
        recentUserMessages: userLines,
        profileSnippet,
      });
      if (llmRaw) {
        const parsed = parseMemoryJson(llmRaw);
        if (parsed) {
          narrative = parsed.narrative ?? narrative;
          facts = mergeMemoryFacts(facts, parsed.facts);
        }
      }
    }

    await this.prisma.assistantUserMemory.upsert({
      where: { userId },
      create: {
        userId,
        narrative,
        facts: facts as unknown as Prisma.InputJsonValue,
      },
      update: {
        narrative,
        facts: facts as unknown as Prisma.InputJsonValue,
      },
    });
  }

  private async seedFromProfile(
    userId: string,
  ): Promise<AssistantUserMemoryPayload | null> {
    try {
      const payload = await this.profile.get(userId);
      const profile = payload.profile as Record<string, unknown> | null;
      if (!profile) return null;

      const facts: AssistantMemoryFact[] = [];
      const restrictions = profile.dietaryRestrictions;
      if (Array.isArray(restrictions)) {
        for (const r of restrictions) {
          if (typeof r === 'string' && r.trim()) {
            facts.push({
              category: 'constraint',
              text: `Dietary restriction: ${r.trim()}`,
            });
          }
        }
      }
      const preferences = profile.dietaryPreferences;
      if (Array.isArray(preferences)) {
        for (const p of preferences) {
          if (typeof p === 'string' && p.trim()) {
            facts.push({
              category: 'preference',
              text: `Dietary preference: ${p.trim()}`,
            });
          }
        }
      }
      const goal = profile.fitnessGoalPrimary;
      if (typeof goal === 'string' && goal.trim()) {
        facts.push({ category: 'goal', text: `Fitness goal: ${goal.trim()}` });
      }
      const target = profile.targetWeightKg;
      if (typeof target === 'number' && Number.isFinite(target)) {
        facts.push({
          category: 'goal',
          text: `Target weight: ${target} kg`,
        });
      }

      if (!facts.length) return null;

      const existing = await this.prisma.assistantUserMemory.findUnique({
        where: { userId },
      });
      if (existing) return this.serialize(existing);

      const row = await this.prisma.assistantUserMemory.create({
        data: {
          userId,
          narrative: 'Seeded from health profile.',
          facts: facts as unknown as Prisma.InputJsonValue,
        },
      });
      return this.serialize(row);
    } catch {
      return null;
    }
  }

  private async profileSnippet(userId: string): Promise<string> {
    try {
      const payload = await this.profile.get(userId);
      const profile = payload.profile as Record<string, unknown> | null;
      if (!profile) return 'No profile.';
      const parts: string[] = [];
      const goal = profile.fitnessGoalPrimary;
      if (typeof goal === 'string' && goal.trim()) {
        parts.push(`Goal: ${goal.trim()}`);
      }
      const target = profile.targetWeightKg;
      if (typeof target === 'number' && Number.isFinite(target)) {
        parts.push(`Target weight kg: ${target}`);
      }
      if (Array.isArray(profile.dietaryRestrictions)) {
        parts.push(`Restrictions: ${profile.dietaryRestrictions.join(', ')}`);
      }
      if (Array.isArray(profile.dietaryPreferences)) {
        parts.push(`Preferences: ${profile.dietaryPreferences.join(', ')}`);
      }
      return parts.join('; ') || 'No profile fields.';
    } catch {
      return 'Profile unavailable.';
    }
  }

  private serialize(row: {
    narrative: string | null;
    facts: unknown;
    updatedAt: Date;
  }): AssistantUserMemoryPayload {
    return {
      narrative: row.narrative,
      facts: this.parseFacts(row.facts),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private parseFacts(value: unknown): AssistantMemoryFact[] {
    if (!Array.isArray(value)) return [];
    const out: AssistantMemoryFact[] = [];
    for (const item of value) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      if (typeof o.text !== 'string') continue;
      const cat = o.category as string;
      const category =
        cat === 'preference' ||
        cat === 'goal' ||
        cat === 'habit' ||
        cat === 'constraint' ||
        cat === 'note'
          ? cat
          : 'note';
      out.push({
        category,
        text: o.text.slice(0, 160),
        updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : undefined,
      });
    }
    return out;
  }

  private emptyPayload(): AssistantUserMemoryPayload {
    return {
      narrative: null,
      facts: [],
      updatedAt: new Date().toISOString(),
    };
  }
}
