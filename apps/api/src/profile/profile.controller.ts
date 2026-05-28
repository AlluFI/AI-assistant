import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProfileService } from './profile.service';
import { ProfileUpdateDto } from './dto/profile-update.dto';
import { MetricRecordDto } from './dto/metric-record.dto';
import { ActivityRecordDto } from './dto/activity-record.dto';
import { ActivityUpdateDto } from './dto/activity-update.dto';
import { MetricUpdateDto } from './dto/metric-update.dto';
import { PrivacyUpdateDto } from './dto/privacy-update.dto';
import { ConsentDto } from './dto/consent.dto';
import { DeleteRequestDto } from './dto/delete-request.dto';
import { PurgeDueDto } from './dto/purge-due.dto';
import { ResetStartingWeightDto } from './dto/reset-starting-weight.dto';

type AuthRequest = Request & { user: { userId: string } };

@ApiTags('profile')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  get(@Req() req: AuthRequest) {
    return this.profile.get(req.user.userId);
  }

  @Patch()
  upsert(@Req() req: AuthRequest, @Body() dto: ProfileUpdateDto) {
    return this.profile.upsert(req.user.userId, dto);
  }

  @Post('reset-starting-weight')
  resetStartingWeight(
    @Req() req: AuthRequest,
    @Body() dto: ResetStartingWeightDto,
  ) {
    return this.profile.resetStartingWeightHistory(
      req.user.userId,
      dto.startingWeightKg,
    );
  }

  @Get('metrics')
  listMetrics(
    @Req() req: AuthRequest,
    @Query('days') daysRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const days = daysRaw != null ? Number(daysRaw) : undefined;
    const limit = Number(limitRaw ?? 50);
    return this.profile.listMetrics(req.user.userId, days, limit);
  }

  @Post('metrics')
  recordMetric(@Req() req: AuthRequest, @Body() dto: MetricRecordDto) {
    return this.profile.recordMetric(req.user.userId, dto);
  }

  @Patch('metrics/:id')
  updateMetric(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: MetricUpdateDto,
  ) {
    return this.profile.updateMetric(req.user.userId, id, dto);
  }

  @Delete('metrics/:id')
  deleteMetric(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.profile.deleteMetric(req.user.userId, id);
  }

  @Get('activities/catalog')
  activityCatalog() {
    return this.profile.getActivityCatalog();
  }

  @Get('activities')
  listActivities(
    @Req() req: AuthRequest,
    @Query('days') daysRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const days = daysRaw != null ? Number(daysRaw) : undefined;
    const limit = Number(limitRaw ?? 100);
    return this.profile.listActivities(req.user.userId, days, limit);
  }

  @Post('activities')
  recordActivity(@Req() req: AuthRequest, @Body() dto: ActivityRecordDto) {
    return this.profile.recordActivity(req.user.userId, dto);
  }

  @Patch('activities/:id')
  updateActivity(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: ActivityUpdateDto,
  ) {
    return this.profile.updateActivity(req.user.userId, id, dto);
  }

  @Delete('activities/:id')
  deleteActivity(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.profile.deleteActivity(req.user.userId, id);
  }

  @Get('privacy')
  getPrivacy(@Req() req: AuthRequest) {
    return this.profile.getPrivacy(req.user.userId);
  }

  @Patch('privacy')
  upsertPrivacy(@Req() req: AuthRequest, @Body() dto: PrivacyUpdateDto) {
    return this.profile.upsertPrivacy(req.user.userId, dto);
  }

  @Get('consents')
  @Header('Cache-Control', 'no-store')
  listConsents(@Req() req: AuthRequest, @Query('limit') limitRaw?: string) {
    const limit = Number(limitRaw ?? 50);
    return this.profile.listConsents(req.user.userId, limit);
  }

  @Post('consents')
  recordConsent(@Req() req: AuthRequest, @Body() dto: ConsentDto) {
    return this.profile.recordConsent(req.user.userId, dto);
  }

  @Get('export')
  exportData(@Req() req: AuthRequest) {
    return this.profile.exportData(req.user.userId);
  }

  @Get('export/events')
  exportEvents(@Req() req: AuthRequest, @Query('limit') limitRaw?: string) {
    const limit = Number(limitRaw ?? 20);
    return this.profile.listExportEvents(req.user.userId, limit);
  }

  @Get('deletion-request')
  deletionStatus(@Req() req: AuthRequest) {
    return this.profile.getDeletionStatus(req.user.userId);
  }

  @Post('deletion-request')
  requestDeletion(@Req() req: AuthRequest, @Body() dto: DeleteRequestDto) {
    return this.profile.requestDeletion(req.user.userId, dto);
  }

  @Post('deletion-request/cancel')
  cancelDeletion(@Req() req: AuthRequest) {
    return this.profile.cancelDeletion(req.user.userId);
  }

  @Post('deletion-request/purge-due')
  purgeDue(@Body() dto: PurgeDueDto) {
    return this.profile.purgeDue(dto.secret);
  }
}
