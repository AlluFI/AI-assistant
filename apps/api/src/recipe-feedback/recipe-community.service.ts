import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { textToEmbedding } from '../shared/embeddings.util';

const VERIFIED_MIN_RATINGS = 3;
const VERIFIED_MIN_SCORE = 4.0;

@Injectable()
export class RecipeCommunityService {
  constructor(private readonly prisma: PrismaService) {}

  recipeEmbeddingBase(recipe: {
    title: string;
    cuisine: string;
    meal: string;
    summary: string;
    dietaryTags: unknown;
    communityRagText?: string | null;
    verified?: boolean;
    communityScore?: number | null;
  }): string {
    const tags = Array.isArray(recipe.dietaryTags)
      ? (recipe.dietaryTags as string[]).join(' ')
      : '';
    const community = recipe.communityRagText?.trim() ?? '';
    const verified = recipe.verified ? ' community verified favorite' : '';
    const score =
      recipe.communityScore != null && recipe.communityScore > 0
        ? ` community rating ${recipe.communityScore.toFixed(1)}`
        : '';
    return `${recipe.title} ${recipe.cuisine} ${recipe.meal} ${recipe.summary} ${tags}${verified}${score} ${community}`.trim();
  }

  async refreshRecipeCommunityStats(recipeId: string) {
    const approved = await this.prisma.recipeFeedback.findMany({
      where: { recipeId, status: 'approved' },
      select: { rating: true, reviewText: true },
      orderBy: { createdAt: 'desc' },
    });

    const count = approved.length;
    const communityScore =
      count > 0
        ? Math.round(
            (approved.reduce((s, r) => s + r.rating, 0) / count) * 10,
          ) / 10
        : null;

    const verified =
      count >= VERIFIED_MIN_RATINGS &&
      communityScore != null &&
      communityScore >= VERIFIED_MIN_SCORE;

    const snippets = approved
      .map((r) => r.reviewText?.trim())
      .filter((t): t is string => Boolean(t))
      .slice(0, 5);
    const communityRagText =
      snippets.length > 0
        ? `Community reviews: ${snippets.join(' | ')}`
        : verified
          ? 'Highly rated by the community.'
          : null;

    const recipe = await this.prisma.recipe.update({
      where: { id: recipeId },
      data: {
        communityScore,
        communityRatingCount: count,
        verified,
        communityRagText,
      },
    });

    const embedding = textToEmbedding(this.recipeEmbeddingBase(recipe));
    await this.prisma.recipe.update({
      where: { id: recipeId },
      data: { embedding: embedding as unknown as Prisma.InputJsonValue },
    });

    return {
      communityScore,
      communityRatingCount: count,
      verified,
      communityRagText,
    };
  }

  async getCommunityMap(recipeIds: string[]) {
    if (!recipeIds.length) return new Map<string, CommunityMeta>();
    const rows = await this.prisma.recipe.findMany({
      where: { id: { in: recipeIds } },
      select: {
        id: true,
        communityScore: true,
        communityRatingCount: true,
        verified: true,
      },
    });
    return new Map(rows.map((r) => [r.id, r]));
  }
}

export type CommunityMeta = {
  id: string;
  communityScore: number | null;
  communityRatingCount: number;
  verified: boolean;
};
