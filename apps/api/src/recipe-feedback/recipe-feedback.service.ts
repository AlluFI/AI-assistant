import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ModerateRecipeFeedbackDto } from './dto/moderate-recipe-feedback.dto';
import { SubmitRecipeFeedbackDto } from './dto/submit-recipe-feedback.dto';
import { RecipeCommunityService } from './recipe-community.service';

@Injectable()
export class RecipeFeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly community: RecipeCommunityService,
  ) {}

  isModerator(email: string): boolean {
    const raw =
      this.config.get<string>('RECIPE_MODERATOR_EMAILS') ??
      'demo@numbers.local';
    const list = raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    return list.includes(email.trim().toLowerCase());
  }

  async submit(userId: string, dto: SubmitRecipeFeedbackDto) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: dto.recipeId },
      select: { id: true },
    });
    if (!recipe) throw new NotFoundException('Recipe not found');

    const reviewText = dto.reviewText?.trim() || null;
    const status = reviewText && reviewText.length > 0 ? 'pending' : 'approved';

    const row = await this.prisma.recipeFeedback.upsert({
      where: {
        recipeId_userId: { recipeId: dto.recipeId, userId },
      },
      create: {
        recipeId: dto.recipeId,
        userId,
        rating: dto.rating,
        reviewText,
        status,
      },
      update: {
        rating: dto.rating,
        reviewText,
        status,
      },
    });

    let community = null;
    if (status === 'approved') {
      community = await this.community.refreshRecipeCommunityStats(
        dto.recipeId,
      );
    }

    return {
      feedback: this.serializeFeedback(row),
      message:
        status === 'pending'
          ? 'Review submitted for moderation. Your rating is saved; text will affect RAG after approval.'
          : 'Thank you — your rating improves community recipe recommendations.',
      community,
    };
  }

  async getRecipeCommunity(recipeId: string, userId: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      select: {
        id: true,
        title: true,
        communityScore: true,
        communityRatingCount: true,
        verified: true,
      },
    });
    if (!recipe) throw new NotFoundException('Recipe not found');

    const [approvedReviews, mine] = await Promise.all([
      this.prisma.recipeFeedback.findMany({
        where: { recipeId, status: 'approved', reviewText: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          rating: true,
          reviewText: true,
          createdAt: true,
          user: { select: { displayName: true, email: true } },
        },
      }),
      this.prisma.recipeFeedback.findUnique({
        where: { recipeId_userId: { recipeId, userId } },
      }),
    ]);

    return {
      recipeId: recipe.id,
      title: recipe.title,
      communityScore: recipe.communityScore,
      communityRatingCount: recipe.communityRatingCount,
      verified: recipe.verified,
      approvedReviews: approvedReviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        reviewText: r.reviewText,
        createdAt: r.createdAt,
        author: r.user.displayName ?? r.user.email.split('@')[0],
      })),
      myFeedback: mine ? this.serializeFeedback(mine) : null,
    };
  }

  async listPending(userEmail: string) {
    if (!this.isModerator(userEmail)) {
      throw new ForbiddenException('Moderator access required');
    }
    const rows = await this.prisma.recipeFeedback.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 50,
      include: {
        recipe: { select: { id: true, title: true, cuisine: true } },
        user: { select: { email: true, displayName: true } },
      },
    });
    return rows.map((r) => ({
      ...this.serializeFeedback(r),
      recipeTitle: r.recipe.title,
      recipeCuisine: r.recipe.cuisine,
      authorEmail: r.user.email,
      authorName: r.user.displayName,
    }));
  }

  async moderate(
    feedbackId: string,
    userEmail: string,
    dto: ModerateRecipeFeedbackDto,
  ) {
    if (!this.isModerator(userEmail)) {
      throw new ForbiddenException('Moderator access required');
    }
    const row = await this.prisma.recipeFeedback.findUnique({
      where: { id: feedbackId },
    });
    if (!row) throw new NotFoundException('Feedback not found');

    const updated = await this.prisma.recipeFeedback.update({
      where: { id: feedbackId },
      data: { status: dto.status },
    });

    if (dto.status === 'approved') {
      await this.community.refreshRecipeCommunityStats(row.recipeId);
    } else {
      await this.community.refreshRecipeCommunityStats(row.recipeId);
    }

    return {
      feedback: this.serializeFeedback(updated),
      message:
        dto.status === 'approved'
          ? 'Review approved and RAG index updated.'
          : 'Review rejected.',
    };
  }

  async listTopVerified(limit = 10) {
    return this.prisma.recipe.findMany({
      where: { verified: true },
      orderBy: [{ communityScore: 'desc' }, { communityRatingCount: 'desc' }],
      take: limit,
      select: {
        id: true,
        title: true,
        cuisine: true,
        meal: true,
        summary: true,
        communityScore: true,
        communityRatingCount: true,
        verified: true,
        timeMinutes: true,
      },
    });
  }

  private serializeFeedback(row: {
    id: string;
    recipeId: string;
    userId: string;
    rating: number;
    reviewText: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      recipeId: row.recipeId,
      userId: row.userId,
      rating: row.rating,
      reviewText: row.reviewText,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
