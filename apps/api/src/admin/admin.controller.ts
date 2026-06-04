import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminService } from './admin.service';

type AuthRequest = Request & { user: { userId: string; email: string } };

@ApiTags('admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('status')
  status(@Req() req: AuthRequest) {
    return this.admin.status(req.user.email);
  }

  @Get('deletion-queue')
  deletionQueue(@Req() req: AuthRequest) {
    return this.admin.listDeletionQueue(req.user.email);
  }

  @Post('purge-due')
  purgeDue(@Req() req: AuthRequest) {
    return this.admin.purgeDue(req.user.email);
  }
}
