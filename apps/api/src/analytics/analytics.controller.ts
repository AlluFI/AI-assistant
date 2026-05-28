import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

type AuthRequest = Request & { user: { userId: string } };

@ApiTags('analytics')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('summary')
  summary(@Req() req: AuthRequest) {
    return this.analytics.getSummary(req.user.userId);
  }

  @Get('series/weight')
  weightSeries(@Req() req: AuthRequest, @Query('days') daysRaw?: string) {
    const days = Math.min(365, Math.max(7, Number(daysRaw ?? 90)));
    return this.analytics.weightSeries(req.user.userId, days);
  }

  @Get('series/wellness')
  wellnessSeries(@Req() req: AuthRequest, @Query('days') daysRaw?: string) {
    const days = Math.min(365, Math.max(7, Number(daysRaw ?? 90)));
    return this.analytics.wellnessSeries(req.user.userId, days);
  }

  @Get('series/activity')
  activitySeries(@Req() req: AuthRequest, @Query('days') daysRaw?: string) {
    const days = Math.min(365, Math.max(7, Number(daysRaw ?? 90)));
    return this.analytics.activitySeries(req.user.userId, days);
  }

  @Get('summaries/progress')
  progressSummaries(@Req() req: AuthRequest) {
    return this.analytics.progressSummaries(req.user.userId);
  }
}
