import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { cosineSimilarity, textToEmbedding } from '../shared/embeddings.util';

export type RetrievedRecipe = {
  id: string;
  title: string;
  cuisine: string;
  relevanceScore: number;
  summary: string;
  dietaryTags: string[];
};

@Injectable()
export class RagService {
  constructor(private readonly prisma: PrismaService) {}

  recipeEmbeddingText(recipe: {
    title: string;
    cuisine: string;
    summary: string;
    dietaryTags: unknown;
    meal: string;
  }): string {
    const tags = Array.isArray(recipe.dietaryTags)
      ? recipe.dietaryTags.join(' ')
      : '';
    return `${recipe.title} ${recipe.cuisine} ${recipe.meal} ${recipe.summary} ${tags}`;
  }

  async ensureRecipeEmbedding(recipeId: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
    });
    if (!recipe) return;
    if (recipe.embedding) return;
    const embedding = textToEmbedding(this.recipeEmbeddingText(recipe));
    await this.prisma.recipe.update({
      where: { id: recipeId },
      data: { embedding: embedding as unknown as Prisma.InputJsonValue },
    });
  }

  async searchRecipes(
    query: string,
    opts?: {
      limit?: number;
      cuisine?: string;
      dietaryTags?: string[];
      maxPrepMinutes?: number;
    },
  ): Promise<RetrievedRecipe[]> {
    const limit = Math.min(20, Math.max(1, opts?.limit ?? 5));
    const queryVec = textToEmbedding(query);
    const where: Prisma.RecipeWhereInput = {};
    if (opts?.cuisine) {
      where.cuisine = { equals: opts.cuisine, mode: 'insensitive' };
    }
    if (opts?.maxPrepMinutes) {
      where.timeMinutes = { lte: opts.maxPrepMinutes };
    }
    const recipes = await this.prisma.recipe.findMany({
      where,
      take: 500,
    });
    const scored = recipes
      .map((r) => {
        const emb =
          (r.embedding as number[] | null) ??
          textToEmbedding(this.recipeEmbeddingText(r));
        let score = cosineSimilarity(queryVec, emb);
        const tags = Array.isArray(r.dietaryTags)
          ? (r.dietaryTags as string[])
          : [];
        if (opts?.dietaryTags?.length) {
          const overlap = opts.dietaryTags.filter((t) =>
            tags.some((x) => x.toLowerCase() === t.toLowerCase()),
          ).length;
          score += overlap * 0.05;
        }
        return {
          id: r.id,
          title: r.title,
          cuisine: r.cuisine,
          relevanceScore: Math.round(score * 1000) / 1000,
          summary: r.summary,
          dietaryTags: tags,
        };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
    return scored;
  }

  buildAugmentedPrompt(
    userQuery: string,
    retrieved: RetrievedRecipe[],
  ): string {
    const examples = retrieved
      .map(
        (r, i) =>
          `${i + 1}. [${r.id}] ${r.title} (${r.cuisine}, score ${r.relevanceScore}): ${r.summary}`,
      )
      .join('\n');
    return [
      `User request: ${userQuery}`,
      'Retrieved recipes from knowledge base (use as grounding, adapt to user preferences):',
      examples || '(no close matches — stay conservative and realistic)',
      'Generate a customized recipe JSON grounded in these examples.',
    ].join('\n\n');
  }
}
