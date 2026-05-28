import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnthropicWingmanService } from './anthropic-wingman.service';
import { OpenAiWingmanService } from './openai-wingman.service';
import type { WingmanChatResult, WingmanChatTurn } from './wingman-chat.types';
import type { WingmanStreamEvent } from './wingman-stream.types';

export type WingmanProviderId = 'anthropic' | 'openai';

@Injectable()
export class WingmanLlmFacade {
  constructor(
    private readonly config: ConfigService,
    private readonly anthropic: AnthropicWingmanService,
    private readonly openai: OpenAiWingmanService,
  ) {}

  resolveProvider(): WingmanProviderId {
    const preferred = (
      this.config.get<string>('ASSISTANT_LLM_PROVIDER') ?? 'anthropic'
    ).toLowerCase();
    if (preferred === 'openai' && this.openai.isConfigured) return 'openai';
    if (this.anthropic.isConfigured) return 'anthropic';
    if (this.openai.isConfigured) return 'openai';
    throw new Error('No wingman LLM provider configured');
  }

  isConfigured(): boolean {
    return this.anthropic.isConfigured || this.openai.isConfigured;
  }

  streamingEnabled(): boolean {
    return (
      this.config.get<string>('ASSISTANT_STREAMING') !== 'false' &&
      this.isConfigured()
    );
  }

  private client() {
    const id = this.resolveProvider();
    return id === 'openai' ? this.openai : this.anthropic;
  }

  async chat(params: {
    system: string;
    history: WingmanChatTurn[];
    userMessage: string;
    executeTool: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<unknown>;
  }): Promise<WingmanChatResult> {
    return this.client().chat(params);
  }

  async *chatStream(params: {
    system: string;
    history: WingmanChatTurn[];
    userMessage: string;
    executeTool: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<unknown>;
  }): AsyncGenerator<WingmanStreamEvent> {
    yield* this.client().chatStream(params);
  }

  async summarizeConversation(
    turns: Array<{ role: string; content: string }>,
  ): Promise<string | null> {
    if (!this.isConfigured()) return null;
    const excerpt = turns
      .slice(-14)
      .map((t) => `${t.role}: ${t.content.trim().slice(0, 200)}`)
      .join('\n');
    const system =
      'Compress this wellness chat into 2-3 short sentences for future context. Mention goals, metrics discussed, and open questions. No medical advice. Max 400 characters.';
    try {
      return await this.client().summarize(system, excerpt);
    } catch {
      return null;
    }
  }

  async consolidateUserMemory(params: {
    existingNarrative: string | null;
    existingFacts: Array<{ category: string; text: string }>;
    recentUserMessages: string[];
    profileSnippet: string;
  }): Promise<string | null> {
    if (!this.isConfigured()) return null;

    const existingFacts = params.existingFacts
      .map((f) => `- [${f.category}] ${f.text}`)
      .join('\n');
    const recent = params.recentUserMessages
      .slice(-15)
      .map((l) => l.trim().slice(0, 200))
      .join('\n');

    const system = `You maintain a compact long-term memory for a wellness coaching app.
Return JSON only (no markdown): {"narrative":"2-3 sentences max 500 chars","facts":[{"category":"preference|goal|habit|constraint|note","text":"short fact"}]}
Rules:
- Store only what the user stated or clearly implied (preferences, goals, habits, constraints).
- Never store email, password, DOB, or other account credentials.
- Merge with existing memory; drop outdated contradicted facts.
- Max 12 facts; each text under 120 characters.
- narrative summarizes stable context for future chats.`;

    const userContent = `Profile: ${params.profileSnippet}

Existing narrative: ${params.existingNarrative ?? '(none)'}

Existing facts:
${existingFacts || '(none)'}

Recent user messages:
${recent || '(none)'}`;

    try {
      return await this.client().summarize(system, userContent);
    } catch {
      return null;
    }
  }
}
