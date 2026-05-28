import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  LlmChatParams,
  LlmChatResult,
  LlmClient,
} from './llm-client.interface';

/**
 * Anthropic wingman client — bootstrap only reports configuration.
 * Wire Messages API here when ASSISTANT_ENABLED is turned on.
 */
@Injectable()
export class AnthropicClientService implements LlmClient {
  readonly provider = 'anthropic';

  constructor(private readonly config: ConfigService) {}

  get model(): string {
    return (
      this.config.get<string>('ASSISTANT_MODEL') ?? 'claude-sonnet-4-20250514'
    );
  }

  get isConfigured(): boolean {
    return Boolean(this.config.get<string>('ANTHROPIC_API_KEY')?.trim());
  }

  chat(params: LlmChatParams): Promise<LlmChatResult> {
    void params;
    if (!this.isConfigured) {
      return Promise.reject(new Error('ANTHROPIC_API_KEY is not set'));
    }
    return Promise.reject(
      new Error(
        'Anthropic wingman chat is not implemented yet — enable after tool loop ships',
      ),
    );
  }
}
