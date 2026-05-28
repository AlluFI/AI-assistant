import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ASSISTANT_TOOL_DEFINITIONS } from '../../assistant/assistant-tool-definitions';
import type { WingmanChatResult, WingmanChatTurn } from './wingman-chat.types';
import type { WingmanStreamEvent } from './wingman-stream.types';

@Injectable()
export class AnthropicWingmanService {
  private readonly requestTimeoutMs = 60_000;
  private readonly maxRounds = 6;

  constructor(private readonly config: ConfigService) {}

  get isConfigured(): boolean {
    return Boolean(this.config.get<string>('ANTHROPIC_API_KEY')?.trim());
  }

  get model(): string {
    return (
      this.config.get<string>('ASSISTANT_MODEL') ?? 'claude-sonnet-4-20250514'
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
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

    const tools = ASSISTANT_TOOL_DEFINITIONS.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));

    const messages: Array<Record<string, unknown>> = [
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
        max_tokens: 1024,
        system: params.system,
        messages,
        tools,
      };

      const data = await this.post(apiKey, body);
      const content = (data.content ?? []) as Array<{
        type: string;
        text?: string;
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      }>;

      const toolUses = content.filter((c) => c.type === 'tool_use');
      if (toolUses.length) {
        messages.push({ role: 'assistant', content });
        const toolResults = [];
        for (const tu of toolUses) {
          const name = tu.name ?? '';
          const args = tu.input ?? {};
          const result = await params.executeTool(name, args);
          toolTraces.push({
            name,
            args,
            result,
            resultSummary: JSON.stringify(result).slice(0, 500),
          });
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: JSON.stringify(result),
          });
        }
        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      const text = content
        .filter((c) => c.type === 'text')
        .map((c) => c.text ?? '')
        .join('')
        .trim();
      if (!text) throw new Error('Anthropic returned empty content');
      return {
        content: text,
        provider: 'anthropic',
        model: this.model,
        toolTraces,
      };
    }

    throw new Error('Anthropic tool loop exceeded');
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
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

    const tools = ASSISTANT_TOOL_DEFINITIONS.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));

    const messages: Array<Record<string, unknown>> = [
      ...params.history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: params.userMessage },
    ];

    const toolTraces: WingmanChatResult['toolTraces'] = [];

    for (let round = 0; round < this.maxRounds; round++) {
      const tokenBuffer: string[] = [];
      const { content, stopReason } = await this.postStream(
        apiKey,
        {
          model: this.model,
          max_tokens: 1024,
          system: params.system,
          messages,
          tools,
          stream: true,
        },
        (t) => tokenBuffer.push(t),
      );

      const toolUses = content.filter((c) => c.type === 'tool_use');
      if (toolUses.length) {
        messages.push({ role: 'assistant', content });
        const toolResults = [];
        for (const tu of toolUses) {
          const name = tu.name ?? '';
          const args = tu.input ?? {};
          yield { type: 'tool_start', name, args };
          const result = await params.executeTool(name, args);
          const resultSummary = JSON.stringify(result).slice(0, 500);
          toolTraces.push({
            name,
            args,
            result,
            resultSummary,
          });
          yield { type: 'tool_end', name, resultSummary };
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: JSON.stringify(result),
          });
        }
        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      const text = content
        .filter((c) => c.type === 'text')
        .map((c) => c.text ?? '')
        .join('')
        .trim();
      if (!text && stopReason !== 'end_turn') {
        throw new Error('Anthropic returned empty content');
      }
      if (!text) throw new Error('Anthropic returned empty content');

      for (const chunk of tokenBuffer) {
        yield { type: 'token', text: chunk };
      }
      if (!tokenBuffer.length) {
        for (const chunk of text.match(/.{1,12}/gs) ?? [text]) {
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

    throw new Error('Anthropic tool loop exceeded');
  }

  async summarize(system: string, userContent: string): Promise<string> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    const data = await this.post(apiKey, {
      model: this.model,
      max_tokens: 150,
      system,
      messages: [{ role: 'user', content: userContent }],
    });
    const text = (
      (data.content ?? []) as Array<{ type: string; text?: string }>
    )
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('')
      .trim();
    if (!text) throw new Error('Anthropic summarize returned empty');
    return text;
  }

  private async postStream(
    apiKey: string,
    body: Record<string, unknown>,
    onDelta?: (text: string) => void,
  ): Promise<{
    content: Array<{
      type: string;
      text?: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
    }>;
    stopReason?: string;
  }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    const contentBlocks: Array<{
      type: string;
      text?: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
    }> = [];
    let stopReason: string | undefined;
    let currentBlockIdx = -1;
    const jsonBuffers = new Map<number, string>();

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Anthropic ${resp.status}: ${errText.slice(0, 400)}`);
      }
      if (!resp.body) throw new Error('Anthropic stream missing body');

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
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          const event = JSON.parse(data) as {
            type?: string;
            index?: number;
            delta?: { type?: string; text?: string; partial_json?: string };
            content_block?: {
              type: string;
              id?: string;
              name?: string;
            };
            message?: { stop_reason?: string };
          };

          if (event.type === 'message_start' && event.message?.stop_reason) {
            stopReason = event.message.stop_reason;
          }
          if (
            event.type === 'message_delta' &&
            event.delta?.type === 'message_delta'
          ) {
            stopReason =
              (event as { delta?: { stop_reason?: string } }).delta
                ?.stop_reason ?? stopReason;
          }
          if (event.type === 'content_block_start' && event.content_block) {
            currentBlockIdx = event.index ?? contentBlocks.length;
            contentBlocks[currentBlockIdx] = {
              type: event.content_block.type,
              id: event.content_block.id,
              name: event.content_block.name,
              text: event.content_block.type === 'text' ? '' : undefined,
              input: event.content_block.type === 'tool_use' ? {} : undefined,
            };
          }
          if (event.type === 'content_block_delta' && event.delta) {
            const idx = event.index ?? currentBlockIdx;
            if (event.delta.type === 'text_delta' && event.delta.text) {
              if (!contentBlocks[idx]) {
                contentBlocks[idx] = { type: 'text', text: '' };
              }
              contentBlocks[idx].text =
                (contentBlocks[idx].text ?? '') + event.delta.text;
              onDelta?.(event.delta.text);
            }
            if (
              event.delta.type === 'input_json_delta' &&
              event.delta.partial_json
            ) {
              jsonBuffers.set(
                idx,
                (jsonBuffers.get(idx) ?? '') + event.delta.partial_json,
              );
            }
          }
        }
      }

      for (const [idx, json] of jsonBuffers) {
        if (contentBlocks[idx]?.type === 'tool_use') {
          try {
            contentBlocks[idx].input = JSON.parse(json) as Record<
              string,
              unknown
            >;
          } catch {
            contentBlocks[idx].input = {};
          }
        }
      }

      return { content: contentBlocks.filter(Boolean), stopReason };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async post(apiKey: string, body: Record<string, unknown>) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Anthropic ${resp.status}: ${errText.slice(0, 400)}`);
      }
      return resp.json() as Promise<{ content?: unknown[] }>;
    } finally {
      clearTimeout(timeout);
    }
  }
}
