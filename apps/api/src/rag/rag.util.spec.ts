import { textToEmbedding } from '../shared/embeddings.util';
import {
  buildAugmentedRagPrompt,
  recipeEmbeddingVector,
  scoreRecipeRelevance,
  sortRetrievedRecipes,
} from './rag.util';

describe('rag.util', () => {
  const queryVec = textToEmbedding('high protein lunch');

  it('boosts verified recipes and dietary tag overlap', () => {
    const baseTags = {
      dietaryTags: ['high-protein'],
      communityScore: null,
      communityRatingCount: 0,
      verified: false,
    };
    const emb = textToEmbedding('grilled chicken bowl');
    const plain = scoreRecipeRelevance(queryVec, emb, baseTags);
    const boosted = scoreRecipeRelevance(
      queryVec,
      emb,
      {
        ...baseTags,
        verified: true,
        communityScore: 5,
        communityRatingCount: 10,
      },
      { dietaryTags: ['high-protein'] },
    );
    expect(boosted).toBeGreaterThan(plain);
  });

  it('sorts verified recipes ahead of higher-scoring unverified ones', () => {
    const sorted = sortRetrievedRecipes([
      { id: 'a', verified: false, relevanceScore: 0.9 },
      { id: 'b', verified: true, relevanceScore: 0.5 },
    ] as Parameters<typeof sortRetrievedRecipes>[0]);
    expect(sorted[0].id).toBe('b');
  });

  it('builds augmented prompt with recipe lines', () => {
    const prompt = buildAugmentedRagPrompt('light dinner', [
      {
        id: 'r1',
        title: 'Salmon bowl',
        cuisine: 'nordic',
        relevanceScore: 0.82,
        summary: 'Baked salmon with greens.',
        dietaryTags: ['pescatarian'],
        communityScore: 4.5,
        communityRatingCount: 12,
        verified: true,
      },
    ]);
    expect(prompt).toContain('User request: light dinner');
    expect(prompt).toContain('[r1] Salmon bowl');
    expect(prompt).toContain('[verified]');
  });

  it('falls back to text embedding when recipe embedding is missing', () => {
    const fromText = recipeEmbeddingVector(null, 'tofu stir fry');
    const direct = textToEmbedding('tofu stir fry');
    expect(fromText).toEqual(direct);
  });
});
