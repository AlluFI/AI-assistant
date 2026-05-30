import {
  Body,
  Controller,
  Get,
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
import { ModerateRecipeFeedbackDto } from './dto/moderate-recipe-feedback.dto';
import { SubmitRecipeFeedbackDto } from './dto/submit-recipe-feedback.dto';
import { RecipeFeedbackService } from './recipe-feedback.service';

type AuthRequest = Request & { user: { userId: string; email: string } };

@ApiTags('recipe-feedback')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('recipe-feedback')
export class RecipeFeedbackController {
  constructor(private readonly feedback: RecipeFeedbackService) {}

  @Post()
  submit(@Req() req: AuthRequest, @Body() dto: SubmitRecipeFeedbackDto) {
    return this.feedback.submit(req.user.userId, dto);
  }

  @Get('recipe/:recipeId')
  forRecipe(@Req() req: AuthRequest, @Param('recipeId') recipeId: string) {
    return this.feedback.getRecipeCommunity(recipeId, req.user.userId);
  }

  @Get('verified')
  verified(@Query('limit') limitRaw?: string) {
    const limit = Math.min(20, Math.max(1, Number(limitRaw ?? 10)));
    return this.feedback.listTopVerified(limit);
  }

  @Get('pending')
  pending(@Req() req: AuthRequest) {
    return this.feedback.listPending(req.user.email);
  }

  @Get('moderator-status')
  moderatorStatus(@Req() req: AuthRequest) {
    return { isModerator: this.feedback.isModerator(req.user.email) };
  }

  @Patch(':id/moderate')
  moderate(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: ModerateRecipeFeedbackDto,
  ) {
    return this.feedback.moderate(id, req.user.email, dto);
  }
}
