import { cosineSimilarity, textToEmbedding } from './embeddings.util';

describe('embeddings.util', () => {
  it('produces deterministic embeddings for the same text', () => {
    const a = textToEmbedding('grilled chicken salad');
    const b = textToEmbedding('grilled chicken salad');
    expect(a).toEqual(b);
  });

  it('returns unit-length vectors', () => {
    const vec = textToEmbedding('high protein breakfast');
    const mag = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
    expect(mag).toBeCloseTo(1, 5);
  });

  it('scores identical texts with cosine similarity 1', () => {
    const text = 'mediterranean quinoa bowl';
    const sim = cosineSimilarity(textToEmbedding(text), textToEmbedding(text));
    expect(sim).toBeCloseTo(1, 5);
  });

  it('scores related queries higher than unrelated ones', () => {
    const query = textToEmbedding('chicken rice dinner');
    const related = cosineSimilarity(
      query,
      textToEmbedding('chicken breast with rice'),
    );
    const unrelated = cosineSimilarity(
      query,
      textToEmbedding('chocolate cake dessert'),
    );
    expect(related).toBeGreaterThan(unrelated);
  });
});
