import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MealPhotosService } from './meal-photos.service';

type AuthRequest = Request & { user: { userId: string } };

@ApiTags('meal-photos')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('meal-photos')
export class MealPhotosController {
  constructor(private readonly mealPhotos: MealPhotosService) {}

  @Get()
  @ApiOperation({ summary: 'List recent meal photo scans' })
  list(@Req() req: AuthRequest, @Query('limit') limit?: string) {
    const n = Number(limit ?? 10);
    return this.mealPhotos.listRecent(
      req.user.userId,
      Number.isFinite(n) ? n : 10,
    );
  }

  @Get(':scanId')
  @ApiOperation({ summary: 'Get a meal photo scan by id' })
  get(@Req() req: AuthRequest, @Param('scanId') scanId: string) {
    return this.mealPhotos.getScan(req.user.userId, scanId);
  }

  @Post('analyze')
  @ApiOperation({
    summary:
      'Analyze a meal photo with Gemini (foods only); nutrition from database',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary' },
        date: { type: 'string', example: '2026-05-29' },
        mealType: { type: 'string', example: 'lunch' },
      },
      required: ['image'],
    },
  })
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 6 * 1024 * 1024 },
    }),
  )
  analyze(
    @Req() req: AuthRequest,
    @UploadedFile() file: Express.Multer.File,
    @Query('date') date?: string,
    @Query('mealType') mealType?: string,
  ) {
    return this.mealPhotos.analyze(req.user.userId, file, { date, mealType });
  }

  @Post(':scanId/confirm')
  @ApiOperation({ summary: 'Confirm scan and log intake to daily totals' })
  confirm(@Req() req: AuthRequest, @Param('scanId') scanId: string) {
    return this.mealPhotos.confirm(req.user.userId, scanId);
  }
}
