import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NutritionService } from './nutrition.service';
import { NutritionProfileUpdateDto } from './dto/nutrition-profile-update.dto';
import {
  DIETARY_PREFERENCE_VALUES,
  DIETARY_RESTRICTION_VALUES,
} from '../shared/dietary-catalog';

type AuthRequest = Request & { user: { userId: string } };

@ApiTags('nutrition')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('nutrition')
export class NutritionController {
  constructor(private readonly nutrition: NutritionService) {}

  @Get('catalog')
  catalog() {
    return {
      dietaryPreferences: DIETARY_PREFERENCE_VALUES,
      dietaryRestrictions: DIETARY_RESTRICTION_VALUES,
    };
  }

  @Get('profile')
  getProfile(@Req() req: AuthRequest) {
    return this.nutrition.getCombinedProfile(req.user.userId);
  }

  @Patch('profile')
  updateProfile(
    @Req() req: AuthRequest,
    @Body() dto: NutritionProfileUpdateDto,
  ) {
    return this.nutrition.upsertNutritionProfile(req.user.userId, dto);
  }

  @Post('profile/apply-suggested-targets')
  applySuggested(@Req() req: AuthRequest) {
    return this.nutrition.applySuggestedTargets(req.user.userId);
  }

  @Post('profile/apply-ai-targets')
  applyAiTargets(@Req() req: AuthRequest) {
    return this.nutrition.applyAiSuggestedTargets(req.user.userId);
  }
}
