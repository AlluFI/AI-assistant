import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InsightsService } from './insights.service';
import { GenerateInsightDto } from './dto/generate-insight.dto';

type AuthRequest = Request & { user: { userId: string } };

@ApiTags('insights')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('insights')
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get()
  list(@Req() req: AuthRequest, @Query('limit') limitRaw?: string) {
    const limit = Number(limitRaw ?? 20);
    return this.insights.list(req.user.userId, limit);
  }

  @Post('generate')
  generate(@Req() req: AuthRequest, @Body() dto: GenerateInsightDto) {
    return this.insights.generate(req.user.userId, dto.historyDays ?? 30);
  }
}
