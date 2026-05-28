import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ASSISTANT_TOOL_DEFINITIONS } from '../../assistant/assistant-tool-definitions';
import type { WingmanChatResult, WingmanChatTurn } from './wingman-chat.types';
import type { WingmanStreamEvent } from './wingman-stream.types';

type OaiMessage = {
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
export class OpenAiWingmanService {
  private readonly requestTimeoutMs = 45_000;
  private readonly maxRounds = 6;

  constructor(private readonly config: ConfigService) {}

  get isConfigured(): boolean {
    return Boolean(this.config.get<string>('OPENAI_API_KEY')?.trim());
  }

  get model(): string {
    return (
      this.config.get<string>('ASSISTANT_OPENAI_MODEL') ??
      this.config.get<string>('AI_MODEL') ??
      'gpt-4o-mini'
    );
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
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const messages: OaiMessage[] = [
      { role: 'system', content: params.system },
      ...params.history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: params.userMessage },
    ];

    const toolTraces: WingmanChatResult['toolTraces'] = [];

    for (let round = 0; round < this.maxRounds; round++) {
      const body = {
        model: this.model,
        temperature: 0.4,
        top_p: 0.95,
        messages,
        tools: ASSISTANT_TOOL_DEFINITIONS,
        tool_choice: 'auto' as const,
      };

      const resp = await this.post(apiKey, body);
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
          const result = await params.executeTool(call.function.name, args);
          toolTraces.push({
            name: call.function.name,
            args,
            result,
            resultSummary: JSON.stringify(result).slice(0, 500),
          });
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: call.function.name,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      const text = choice.content?.trim();
      if (!text) throw new Error('OpenAI returned empty content');
      return {
        content: text,
        provider: 'openai',
        model: this.model,
        toolTraces,
      };
    }

    throw new Error('Tool call loop exceeded');
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
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const messages: OaiMessage[] = [
      { role: 'system', content: params.system },
      ...params.history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: params.userMessage },
    ];

    const toolTraces: WingmanChatResult['toolTraces'] = [];

    for (let round = 0; round < this.maxRounds; round++) {
      const body = {
        model: this.model,
        temperature: 0.4,
        top_p: 0.95,
        messages,
        tools: ASSISTANT_TOOL_DEFINITIONS,
        tool_choice: 'auto' as const,
        stream: true,
      };

      const tokenBuffer: string[] = [];
      const { message, streamedText } = await this.postStream(
        apiKey,
        body,
        (t) => {
          tokenBuffer.push(t);
        },
      );
      if (message.tool_calls?.length) {
        messages.push({
          role: 'assistant',
          content: message.content ?? null,
          tool_calls: message.tool_calls,
        });
        for (const call of message.tool_calls) {
          const args = JSON.parse(call.function.arguments || '{}') as Record<
            string,
            unknown
          >;
          yield { type: 'tool_start', name: call.function.name, args };
          const result = await params.executeTool(call.function.name, args);
          const resultSummary = JSON.stringify(result).slice(0, 500);
          toolTraces.push({
            name: call.function.name,
            args,
            result,
            resultSummary,
          });
          yield { type: 'tool_end', name: call.function.name, resultSummary };
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: call.function.name,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      const text = (message.content ?? streamedText).trim();
      if (!text) throw new Error('OpenAI returned empty content');
      for (const chunk of tokenBuffer) {
        yield { type: 'token', text: chunk };
      }
      if (!tokenBuffer.length && streamedText) {
        for (const chunk of this.chunkText(streamedText)) {
          yield { type: 'token', text: chunk };
        }
      }
      yield {
        type: 'done',
        content: text,
        toolTraces: toolTraces.map((t) => ({
          name: t.name,
          args: t.args,
          resultSummary: t.resultSummary,
        })),
      };
      return;
    }

    throw new Error('Tool call loop exceeded');
  }

  async summarize(system: string, userContent: string): Promise<string> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
    const resp = await this.post(apiKey, {
      model: this.model,
      temperature: 0.2,
      max_tokens: 150,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
    });
    const text = resp.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('OpenAI summarize returned empty');
    return text;
  }

  private chunkText(text: string, size = 12): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += size) {
      chunks.push(text.slice(i, i + size));
    }
    return chunks;
  }

  private async postStream(
    apiKey: string,
    body: Record<string, unknown>,
    onDelta?: (text: string) => void,
  ): Promise<{ message: OaiMessage; streamedText: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    let streamedText = '';
    const toolCalls: NonNullable<OaiMessage['tool_calls']> = [];
    const toolArgBuffers = new Map<number, string>();

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
        throw new Error(`OpenAI ${resp.status}: ${errText.slice(0, 400)}`);
      }
      if (!resp.body) throw new Error('OpenAI stream missing body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') continue;
          const parsed = JSON.parse(data) as {
            choices?: Array<{
              delta?: {
                content?: string;
                tool_calls?: Array<{
                  index: number;
                  id?: string;
                  function?: { name?: string; arguments?: string };
                }>;
              };
            }>;
          };
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;
          if (delta.content) {
            streamedText += delta.content;
            onDelta?.(delta.content);
          }
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolCalls[idx]) {
                toolCalls[idx] = {
                  id: tc.id ?? '',
                  type: 'function',
                  function: { name: tc.function?.name ?? '', arguments: '' },
                };
              }
              if (tc.id) toolCalls[idx].id = tc.id;
              if (tc.function?.name) {
                toolCalls[idx].function.name = tc.function.name;
              }
              if (tc.function?.arguments) {
                toolArgBuffers.set(
                  idx,
                  (toolArgBuffers.get(idx) ?? '') + tc.function.arguments,
                );
              }
            }
          }
        }
      }

      for (const [idx, args] of toolArgBuffers) {
        if (toolCalls[idx]) toolCalls[idx].function.arguments = args;
      }

      return {
        message: {
          role: 'assistant',
          content: streamedText || null,
          tool_calls: toolCalls.length ? toolCalls : undefined,
        },
        streamedText,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async post(apiKey: string, body: Record<string, unknown>) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
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
        throw new Error(`OpenAI ${resp.status}: ${errText.slice(0, 400)}`);
      }
      return resp.json() as Promise<{
        choices?: Array<{ message?: OaiMessage }>;
      }>;
    } finally {
      clearTimeout(timeout);
    }
  }
}
