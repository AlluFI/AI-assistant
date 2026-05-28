import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnthropicClientService } from './anthropic-client.service';
import { AnthropicWingmanService } from './anthropic-wingman.service';
import { OpenAiWingmanService } from './openai-wingman.service';
import type { LlmClient } from './llm-client.interface';

@Injectable()
export class AssistantLlmService {
  constructor(
    private readonly config: ConfigService,
    private readonly anthropic: AnthropicClientService,
    readonly anthropicWingman: AnthropicWingmanService,
    readonly openaiWingman: OpenAiWingmanService,
  ) {}

  /** Legacy accessor — prefer AssistantWingmanService for chat. */
  get wingman(): LlmClient {
    return this.anthropic;
  }

  wingmanChatConfigured(): boolean {
    const provider = (
      this.config.get<string>('ASSISTANT_LLM_PROVIDER') ?? 'anthropic'
    ).toLowerCase();
    if (provider === 'openai') return this.openaiWingman.isConfigured;
    return (
      this.anthropicWingman.isConfigured || this.openaiWingman.isConfigured
    );
  }
}
