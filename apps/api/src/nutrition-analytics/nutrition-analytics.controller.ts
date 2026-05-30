import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NutritionAnalyticsService } from './nutrition-analytics.service';

type AuthRequest = Request & { user: { userId: string } };

@ApiTags('nutrition-analytics')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('nutrition-analytics')
export class NutritionAnalyticsController {
  constructor(private readonly analytics: NutritionAnalyticsService) {}

  @Get('daily')
  daily(@Req() req: AuthRequest, @Query('date') date: string) {
    const d = date ?? new Date().toISOString().slice(0, 10);
    return this.analytics.dailySummary(req.user.userId, d);
  }

  @Get('trend')
  trend(@Req() req: AuthRequest, @Query('days') daysRaw?: string) {
    const days = Number(daysRaw ?? 30);
    return this.analytics.trend(req.user.userId, days);
  }

  @Get('weekly')
  weekly(@Req() req: AuthRequest, @Query('end') end?: string) {
    return this.analytics.weeklySummary(req.user.userId, end);
  }

  @Get('insights')
  insights(@Req() req: AuthRequest, @Query('end') end?: string) {
    return this.analytics.aiInsights(req.user.userId, end);
  }

  @Get('micronutrients')
  micronutrients(
    @Req() req: AuthRequest,
    @Query('end') end?: string,
    @Query('days') daysRaw?: string,
  ) {
    const days = Number(daysRaw ?? 7);
    return this.analytics.micronutrientReport(req.user.userId, end, days);
  }
}
