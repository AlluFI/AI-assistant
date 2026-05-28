import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NutritionToolsService } from './nutrition-tools.service';
import { CalculateNutritionDto } from './dto/calculate-nutrition.dto';

type AuthRequest = Request & { user: { userId: string } };

@ApiTags('nutrition-tools')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('nutrition-tools')
export class NutritionToolsController {
  constructor(private readonly tools: NutritionToolsService) {}

  @Post('calculate')
  calculate(@Req() _req: AuthRequest, @Body() dto: CalculateNutritionDto) {
    return this.tools.calculateNutritionViaFunctionCall({
      ingredients: dto.ingredients,
      servings: dto.servings,
    });
  }

  @Post('scale-recipe')
  scale(
    @Req() _req: AuthRequest,
    @Body() body: { recipeId: string; servings: number },
  ) {
    return this.tools.scaleRecipeNutritionViaFunctionCall(
      body.recipeId,
      body.servings,
    );
  }
}
