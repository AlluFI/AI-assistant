import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RecipeCommunityService } from '../recipe-feedback/recipe-community.service';
import { textToEmbedding } from '../shared/embeddings.util';
import {
  buildAugmentedRagPrompt,
  recipeEmbeddingVector,
  scoreRecipeRelevance,
  sortRetrievedRecipes,
  type RetrievedRecipe,
} from './rag.util';

export type { RetrievedRecipe } from './rag.util';

@Injectable()
export class RagService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly community: RecipeCommunityService,
  ) {}

  async ensureRecipeEmbedding(recipeId: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
    });
    if (!recipe) return;
    if (recipe.embedding && !recipe.communityRagText) return;
    const embedding = textToEmbedding(
      this.community.recipeEmbeddingBase(recipe),
    );
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
    const scored = recipes.map((r) => {
      const tags = Array.isArray(r.dietaryTags)
        ? (r.dietaryTags as string[])
        : [];
      const emb = recipeEmbeddingVector(
        r.embedding as number[] | null,
        this.community.recipeEmbeddingBase(r),
      );
      const relevanceScore = scoreRecipeRelevance(
        queryVec,
        emb,
        {
          dietaryTags: tags,
          communityScore: r.communityScore,
          communityRatingCount: r.communityRatingCount,
          verified: r.verified,
        },
        { dietaryTags: opts?.dietaryTags },
      );
      return {
        id: r.id,
        title: r.title,
        cuisine: r.cuisine,
        relevanceScore,
        summary: r.summary,
        dietaryTags: tags,
        communityScore: r.communityScore,
        communityRatingCount: r.communityRatingCount,
        verified: r.verified,
      };
    });
    return sortRetrievedRecipes(scored).slice(0, limit);
  }

  buildAugmentedPrompt(
    userQuery: string,
    retrieved: RetrievedRecipe[],
  ): string {
    return buildAugmentedRagPrompt(userQuery, retrieved);
  }
}
