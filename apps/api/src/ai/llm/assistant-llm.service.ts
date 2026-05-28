import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnthropicWingmanService } from './anthropic-wingman.service';
import { OpenAiWingmanService } from './openai-wingman.service';

@Injectable()
export class AssistantLlmService {
  constructor(
    private readonly config: ConfigService,
    readonly anthropicWingman: AnthropicWingmanService,
    readonly openaiWingman: OpenAiWingmanService,
  ) {}

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
