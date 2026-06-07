export type WingmanHistoryTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export type WingmanContextBudget = {
  /** Total tokens budgeted for system prompt + chat history (excluding current user turn). */
  totalTokenBudget: number;
  /** Reserved for the assistant reply and tool-call rounds. */
  replyReserveTokens: number;
  /** Approximate characters per token for English-heavy text. */
  charsPerToken: number;
  /** Minimum turns to keep when possible (each turn is one message). */
  minHistoryTurns: number;
};

export type TrimmedWingmanHistory = {
  history: WingmanHistoryTurn[];
  usedTokens: number;
  droppedTurns: number;
  historyTokenBudget: number;
};

/** Rough token estimate (no tokenizer dependency). */
export function estimateWingmanTokens(
  text: string,
  charsPerToken: number,
): number {
  const cpt = Number.isFinite(charsPerToken) && charsPerToken > 0 ? charsPerToken : 4;
  if (!text) return 0;
  return Math.ceil(text.length / cpt);
}

/** Per-turn overhead for role labels in chat APIs. */
const TURN_OVERHEAD_TOKENS = 4;

/**
 * Drop the last user turn when it matches the message about to be sent again
 * (user message is persisted before the LLM call).
 */
export function excludePendingUserTurn(
  turns: WingmanHistoryTurn[],
  pendingUserMessage?: string,
): WingmanHistoryTurn[] {
  const pending = pendingUserMessage?.trim();
  if (!pending || turns.length === 0) return turns;
  const last = turns[turns.length - 1];
  if (last.role === 'user' && last.content.trim() === pending) {
    return turns.slice(0, -1);
  }
  return turns;
}

/**
 * Keep the most recent turns that fit the history token budget (walk backward).
 * Returns turns in chronological order.
 */
export function trimHistoryToTokenBudget(
  turns: WingmanHistoryTurn[],
  historyTokenBudget: number,
  opts: Pick<WingmanContextBudget, 'charsPerToken' | 'minHistoryTurns'>,
): TrimmedWingmanHistory {
  const budget = Math.max(1, Math.floor(historyTokenBudget));
  const minTurns = Math.max(0, opts.minHistoryTurns);

  if (turns.length === 0) {
    return {
      history: [],
      usedTokens: 0,
      droppedTurns: 0,
      historyTokenBudget: budget,
    };
  }

  const selected: WingmanHistoryTurn[] = [];
  let usedTokens = 0;

  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i]!;
    const turnTokens =
      estimateWingmanTokens(turn.content, opts.charsPerToken) +
      TURN_OVERHEAD_TOKENS;

    const wouldExceed =
      selected.length >= minTurns && usedTokens + turnTokens > budget;

    if (wouldExceed) break;

    usedTokens += turnTokens;
    selected.push(turn);
  }

  selected.reverse();

  return {
    history: selected,
    usedTokens,
    droppedTurns: Math.max(0, turns.length - selected.length),
    historyTokenBudget: budget,
  };
}

export function resolveWingmanContextBudget(config: {
  get: (key: string) => string | undefined;
}): WingmanContextBudget {
  const total = Number(config.get('ASSISTANT_CONTEXT_TOKEN_BUDGET') ?? 12000);
  const replyReserve = Number(
    config.get('ASSISTANT_CONTEXT_REPLY_RESERVE') ?? 2500,
  );
  const charsPerToken = Number(config.get('ASSISTANT_CHARS_PER_TOKEN') ?? 4);
  const minHistoryTurns = Number(
    config.get('ASSISTANT_CONTEXT_MIN_TURNS') ?? 4,
  );

  return {
    totalTokenBudget: Number.isFinite(total) && total >= 2000 ? total : 12000,
    replyReserveTokens:
      Number.isFinite(replyReserve) && replyReserve >= 500 ? replyReserve : 2500,
    charsPerToken:
      Number.isFinite(charsPerToken) && charsPerToken >= 2 ? charsPerToken : 4,
    minHistoryTurns:
      Number.isFinite(minHistoryTurns) && minHistoryTurns >= 0
        ? Math.min(20, minHistoryTurns)
        : 4,
  };
}

export function buildTokenAwareHistory(
  turns: WingmanHistoryTurn[],
  systemPrompt: string,
  pendingUserMessage: string,
  budget: WingmanContextBudget,
): TrimmedWingmanHistory {
  const withoutPending = excludePendingUserTurn(turns, pendingUserMessage);
  const systemTokens = estimateWingmanTokens(systemPrompt, budget.charsPerToken);
  const pendingTokens = estimateWingmanTokens(
    pendingUserMessage,
    budget.charsPerToken,
  );
  const historyTokenBudget =
    budget.totalTokenBudget -
    budget.replyReserveTokens -
    systemTokens -
    pendingTokens -
    32;

  return trimHistoryToTokenBudget(withoutPending, historyTokenBudget, budget);
}
