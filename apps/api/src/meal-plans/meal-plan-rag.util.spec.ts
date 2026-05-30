import {
  pickGroundedRecipeId,
  pickRetrievedRecipeForVariety,
} from './meal-plan-rag.util';

describe('meal-plan-rag.util', () => {
  describe('pickGroundedRecipeId', () => {
    it('accepts LLM id when it is in the allowed set', () => {
      expect(pickGroundedRecipeId('r2', ['r1', 'r2', 'r3'])).toBe('r2');
    });

    it('falls back to first allowed id when LLM id is invalid', () => {
      expect(pickGroundedRecipeId('r9', ['r1', 'r2'])).toBe('r1');
    });

    it('returns undefined when no candidates exist', () => {
      expect(pickGroundedRecipeId('r1', [])).toBeUndefined();
    });
  });

  describe('pickRetrievedRecipeForVariety', () => {
    it('prefers an unused recipe id', () => {
      const used = new Set(['r1']);
      const pick = pickRetrievedRecipeForVariety(
        [
          { id: 'r1', title: 'A' },
          { id: 'r2', title: 'B' },
        ],
        used,
      );
      expect(pick?.id).toBe('r2');
    });

    it('reuses the first recipe when all are used', () => {
      const used = new Set(['r1', 'r2']);
      const pick = pickRetrievedRecipeForVariety(
        [
          { id: 'r1', title: 'A' },
          { id: 'r2', title: 'B' },
        ],
        used,
      );
      expect(pick?.id).toBe('r1');
    });
  });
});
