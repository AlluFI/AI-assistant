import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DailyCheckInService } from './daily-check-in.service';
import {
  UpsertDailyCheckInDto,
  WearableDemoSyncDto,
} from './dto/upsert-daily-check-in.dto';
import { QuickFoodLogDto } from './dto/quick-food-log.dto';
import { FoodLogService } from './food-log.service';
import { TodayService } from './today.service';

type AuthRequest = Request & { user: { userId: string } };

@ApiTags('daily-wellness')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class DailyWellnessController {
  constructor(
    private readonly today: TodayService,
    private readonly checkIns: DailyCheckInService,
    private readonly foodLog: FoodLogService,
  ) {}

  @Get('today')
  getToday(@Req() req: AuthRequest, @Query('date') date?: string) {
    return this.today.getSummary(req.user.userId, date);
  }

  @Get('daily-check-in')
  getCheckIn(@Req() req: AuthRequest, @Query('date') date?: string) {
    return this.checkIns.getForDate(req.user.userId, date);
  }

  @Put('daily-check-in')
  upsertCheckIn(@Req() req: AuthRequest, @Body() dto: UpsertDailyCheckInDto) {
    return this.checkIns.upsert(req.user.userId, dto);
  }

  @Post('daily-check-in/wearable-demo')
  wearableDemo(@Req() req: AuthRequest, @Body() dto: WearableDemoSyncDto) {
    return this.checkIns.syncWearableDemo(req.user.userId, dto);
  }

  @Post('food-log/quick')
  quickFoodLog(@Req() req: AuthRequest, @Body() dto: QuickFoodLogDto) {
    return this.foodLog.logQuick(req.user.userId, dto);
  }

  @Get('food-log/recent')
  recentFoodLogs(@Req() req: AuthRequest, @Query('limit') limit?: string) {
    return this.foodLog.listRecent(
      req.user.userId,
      limit != null ? Number(limit) : undefined,
    );
  }
}
