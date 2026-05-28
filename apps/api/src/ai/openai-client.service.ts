import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NutritionToolsService } from '../nutrition-tools/nutrition-tools.service';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
};

@Injectable()
export class OpenAiClientService {
  private readonly requestTimeoutMs = 20000;
  private readonly maxAttempts = 3;

  constructor(
    private readonly config: ConfigService,
    private readonly nutritionTools: NutritionToolsService,
  ) {}

  get apiKey(): string | undefined {
    return this.config.get<string>('OPENAI_API_KEY');
  }

  get model(): string {
    return this.config.get<string>('AI_MODEL') ?? 'gpt-4o-mini';
  }

  async chatJson<T>(
    system: string,
    user: string,
    opts?: { temperature?: number; topP?: number; tools?: boolean },
  ): Promise<T> {
    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ];
    const tools = opts?.tools ? this.nutritionTools.toolDefinitions : undefined;
    for (let round = 0; round < 6; round++) {
      const body: Record<string, unknown> = {
        model: this.model,
        temperature: opts?.temperature ?? 0.5,
        top_p: opts?.topP ?? 1,
        messages,
      };
      if (tools?.length) {
        body.tools = tools;
        body.tool_choice = 'auto';
      } else {
        body.response_format = { type: 'json_object' };
      }

      const resp = await this.postChat(body);
      const choice = resp.choices?.[0]?.message;
      if (!choice) throw new Error('OpenAI returned no message');

      if (choice.tool_calls?.length) {
        messages.push({
          role: 'assistant',
          content: choice.content ?? null,
          tool_calls: choice.tool_calls,
        });
        for (const call of choice.tool_calls) {
          const args = JSON.parse(call.function.arguments || '{}') as Record<
            string,
            unknown
          >;
          const result = await this.nutritionTools.executeTool(
            call.function.name,
            args,
          );
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: call.function.name,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      const text = choice.content;
      if (!text) throw new Error('OpenAI returned empty content');
      return JSON.parse(text) as T;
    }
    throw new Error('Tool call loop exceeded');
  }

  private async postChat(body: Record<string, unknown>) {
    const apiKey = this.apiKey;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.requestTimeoutMs,
      );
      try {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!resp.ok) {
          const errText = await resp.text();
          const isRetryable = resp.status === 429 || resp.status >= 500;
          const error = new Error(
            `OpenAI ${resp.status}: ${errText.slice(0, 400)}`,
          );
          if (attempt < this.maxAttempts && isRetryable) {
            await this.sleep(this.retryDelayMs(attempt));
            continue;
          }
          throw error;
        }
        return resp.json() as Promise<{
          choices?: Array<{ message?: ChatMessage }>;
        }>;
      } catch (error) {
        const isTimeout = error instanceof Error && error.name === 'AbortError';
        const isNetworkError = error instanceof TypeError;
        lastError =
          error instanceof Error ? error : new Error('Unknown OpenAI error');
        if (attempt < this.maxAttempts && (isTimeout || isNetworkError)) {
          await this.sleep(this.retryDelayMs(attempt));
          continue;
        }
        if (isTimeout) {
          throw new Error('OpenAI request timeout');
        }
        throw lastError;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new Error('OpenAI request failed');
  }

  private retryDelayMs(attempt: number): number {
    return 300 * 2 ** (attempt - 1);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
