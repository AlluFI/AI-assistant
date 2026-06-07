import {
  buildTokenAwareHistory,
  estimateWingmanTokens,
  excludePendingUserTurn,
  trimHistoryToTokenBudget,
} from './wingman-context.util';

describe('wingman-context.util', () => {
  it('estimateWingmanTokens uses chars per token', () => {
    expect(estimateWingmanTokens('abcd', 4)).toBe(1);
    expect(estimateWingmanTokens('abcdefgh', 4)).toBe(2);
  });

  it('excludePendingUserTurn removes duplicate last user line', () => {
    const turns = [
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi' },
      { role: 'user' as const, content: 'What is my BMI?' },
    ];
    expect(excludePendingUserTurn(turns, 'What is my BMI?')).toHaveLength(2);
    expect(excludePendingUserTurn(turns, 'Other')).toHaveLength(3);
  });

  it('trimHistoryToTokenBudget keeps recent turns first', () => {
    const turns = [
      { role: 'user' as const, content: 'a'.repeat(400) },
      { role: 'assistant' as const, content: 'b'.repeat(400) },
      { role: 'user' as const, content: 'recent question' },
      { role: 'assistant' as const, content: 'recent answer' },
    ];
    const trimmed = trimHistoryToTokenBudget(turns, 100, {
      charsPerToken: 4,
      minHistoryTurns: 2,
    });
    expect(trimmed.history.length).toBeLessThan(turns.length);
    expect(trimmed.history[trimmed.history.length - 1]?.content).toBe(
      'recent answer',
    );
    expect(trimmed.droppedTurns).toBeGreaterThan(0);
  });

  it('buildTokenAwareHistory subtracts system and pending message', () => {
    const turns = [{ role: 'user' as const, content: 'Hi' }];
    const result = buildTokenAwareHistory(
      [...turns, { role: 'user', content: 'Hi again' }],
      'system prompt',
      'Hi again',
      {
        totalTokenBudget: 8000,
        replyReserveTokens: 2000,
        charsPerToken: 4,
        minHistoryTurns: 2,
      },
    );
    expect(result.history).toEqual([{ role: 'user', content: 'Hi' }]);
  });
});
