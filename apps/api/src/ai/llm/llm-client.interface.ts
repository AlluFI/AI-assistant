export type LlmChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type LlmChatParams = {
  messages: LlmChatMessage[];
  temperature?: number;
};

export type LlmChatResult = {
  content: string;
  provider: string;
  model: string;
};

/** Provider-agnostic surface for Phase 3 wingman (see ai-assistant/docs/STACK.md). */
export interface LlmClient {
  readonly provider: string;
  readonly model: string;
  readonly isConfigured: boolean;
  chat(params: LlmChatParams): Promise<LlmChatResult>;
}

export const LLM_CLIENT = Symbol('LLM_CLIENT');
