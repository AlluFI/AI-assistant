export type WingmanStreamEvent =
  | { type: 'token'; text: string }
  | { type: 'tool_start'; name: string; args: Record<string, unknown> }
  | { type: 'tool_end'; name: string; resultSummary: string }
  | {
      type: 'done';
      content: string;
      uiBlocks?: unknown[];
      toolTraces?: Array<{
        name: string;
        args: unknown;
        resultSummary: string;
      }>;
    }
  | { type: 'error'; message: string };
