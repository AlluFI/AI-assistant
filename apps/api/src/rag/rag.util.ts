import { cosineSimilarity, textToEmbedding } from '../shared/embeddings.util';

export type RagRecipeScoreInput = {
  dietaryTags: string[];
  communityScore: number | null;
  communityRatingCount: number;
  verified: boolean;
};

export type RetrievedRecipe = {
  id: string;
  title: string;
  cuisine: string;
  relevanceScore: number;
  summary: string;
  dietaryTags: string[];
  communityScore: number | null;
  communityRatingCount: number;
  verified: boolean;
};

export function scoreRecipeRelevance(
  queryVec: number[],
  recipeEmbedding: number[],
  recipe: RagRecipeScoreInput,
  opts?: { dietaryTags?: string[] },
): number {
  let score = cosineSimilarity(queryVec, recipeEmbedding);
  if (opts?.dietaryTags?.length) {
    const overlap = opts.dietaryTags.filter((t) =>
      recipe.dietaryTags.some((x) => x.toLowerCase() === t.toLowerCase()),
    ).length;
    score += overlap * 0.05;
  }
  if (recipe.communityScore != null && recipe.communityScore > 0) {
    score += (recipe.communityScore / 5) * 0.12;
  }
  if (recipe.verified) {
    score += 0.1;
  }
  if (recipe.communityRatingCount >= 5) {
    score += 0.03;
  }
  return Math.round(score * 1000) / 1000;
}

export function recipeEmbeddingVector(
  embedding: number[] | null | undefined,
  embeddingText: string,
): number[] {
  return embedding ?? textToEmbedding(embeddingText);
}

export function sortRetrievedRecipes<
  T extends {
    verified: boolean;
    relevanceScore: number;
  },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.verified !== b.verified) return a.verified ? -1 : 1;
    return b.relevanceScore - a.relevanceScore;
  });
}

export function buildAugmentedRagPrompt(
  userQuery: string,
  retrieved: RetrievedRecipe[],
): string {
  const examples = retrieved
    .map((r, i) => {
      const badge = r.verified ? ' [verified]' : '';
      const rating =
        r.communityScore != null
          ? ` ★${r.communityScore} (${r.communityRatingCount})`
          : '';
      return `${i + 1}. [${r.id}] ${r.title} (${r.cuisine}, relevance ${r.relevanceScore}${rating})${badge}: ${r.summary}`;
    })
    .join('\n');
  return [
    `User request: ${userQuery}`,
    'Retrieved recipes from knowledge base (use as grounding, adapt to user preferences):',
    examples || '(no close matches — stay conservative and realistic)',
    'Generate a customized recipe JSON grounded in these examples.',
  ].join('\n\n');
}
