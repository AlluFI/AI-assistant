import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AssistantService } from './assistant.service';
import { ConfirmAssistantActionDto } from './dto/confirm-action.dto';
import { CreateAssistantThreadDto } from './dto/create-thread.dto';
import { PatchAssistantThreadDto } from './dto/patch-thread.dto';
import { PostAssistantMessageDto } from './dto/post-message.dto';

type AuthRequest = Request & { user: { userId: string } };

@ApiTags('assistant')
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Get('bootstrap')
  @SkipThrottle()
  @ApiOperation({
    summary: 'Phase 3 readiness (providers, DB, checklist)',
  })
  bootstrap() {
    return this.assistant.getBootstrapReport();
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('nudges')
  @ApiOperation({ summary: 'Opening reminders (weight / activity)' })
  nudges(@Req() req: AuthRequest) {
    return this.assistant.getNudges(req.user.userId);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('onboarding')
  @ApiOperation({
    summary: 'Wingman setup wizard status and opening message',
  })
  onboarding(@Req() req: AuthRequest) {
    return this.assistant.getOnboarding(req.user.userId);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('onboarding/skip')
  @HttpCode(200)
  @ApiOperation({ summary: 'Skip wingman setup wizard' })
  skipOnboarding(@Req() req: AuthRequest) {
    return this.assistant.skipOnboarding(req.user.userId);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('actions/confirm')
  @ApiOperation({
    summary:
      'Confirm a wingman action (log activity/weight, regenerate meal, shopping list)',
  })
  confirmAction(
    @Req() req: AuthRequest,
    @Body() body: ConfirmAssistantActionDto,
  ) {
    return this.assistant.confirmAction(req.user.userId, body);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('memory')
  @ApiOperation({ summary: 'Long-term wingman memory for this user' })
  getMemory(@Req() req: AuthRequest) {
    return this.assistant.getUserMemory(req.user.userId);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Delete('memory')
  @HttpCode(200)
  @ApiOperation({ summary: 'Clear long-term wingman memory' })
  clearMemory(@Req() req: AuthRequest) {
    return this.assistant.clearUserMemory(req.user.userId);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('threads')
  createThread(
    @Req() req: AuthRequest,
    @Body() body: CreateAssistantThreadDto,
  ) {
    return this.assistant.createThread(
      req.user.userId,
      body.title,
      body.coachingMode,
    );
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('threads')
  listThreads(@Req() req: AuthRequest) {
    return this.assistant.listThreads(req.user.userId);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('threads/:threadId')
  getThread(@Req() req: AuthRequest, @Param('threadId') threadId: string) {
    return this.assistant.getThread(req.user.userId, threadId);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Delete('threads/:threadId')
  deleteThread(@Req() req: AuthRequest, @Param('threadId') threadId: string) {
    return this.assistant.deleteThread(req.user.userId, threadId);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Patch('threads/:threadId')
  @ApiOperation({ summary: 'Update thread settings (coaching mode)' })
  patchThread(
    @Req() req: AuthRequest,
    @Param('threadId') threadId: string,
    @Body() body: PatchAssistantThreadDto,
  ) {
    return this.assistant.patchThread(req.user.userId, threadId, body);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('threads/:threadId/messages/stream')
  @SkipThrottle()
  @ApiOperation({
    summary: 'Send a message; SSE stream of tokens, tools, and final reply',
  })
  async streamMessage(
    @Req() req: AuthRequest,
    @Res() res: Response,
    @Param('threadId') threadId: string,
    @Body() body: PostAssistantMessageDto,
  ) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      for await (const event of this.assistant.handleUserMessageStream(
        req.user.userId,
        threadId,
        body.content,
        body.coachingMode,
      )) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
      res.write('data: [DONE]\n\n');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Stream failed';
      res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
    }
    res.end();
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('threads/:threadId/messages')
  @ApiOperation({
    summary: 'Send a message; wingman replies with optional CTAs',
  })
  postMessage(
    @Req() req: AuthRequest,
    @Param('threadId') threadId: string,
    @Body() body: PostAssistantMessageDto,
  ) {
    return this.assistant.handleUserMessage(
      req.user.userId,
      threadId,
      body.content,
      body.coachingMode,
    );
  }
}
