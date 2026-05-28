export type WingmanChatTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export type WingmanChatResult = {
  content: string;
  provider: string;
  model: string;
  toolTraces: Array<{
    name: string;
    args: Record<string, unknown>;
    result: unknown;
    resultSummary: string;
  }>;
};
