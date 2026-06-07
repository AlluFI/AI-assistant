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
import { MealPlansService } from './meal-plans.service';
import { GenerateMealPlanDto } from './dto/generate-meal-plan.dto';
import { SwapMealsDto } from './dto/swap-meals.dto';
import { SelectAlternativeDto } from './dto/select-alternative.dto';
import { UpdateMealSlotDto } from './dto/update-meal-slot.dto';
import { ReorderMealsDto } from './dto/reorder-meals.dto';
import { AddManualMealDto } from './dto/add-manual-meal.dto';
import { ReplaceMealRecipeDto } from './dto/replace-meal-recipe.dto';
import { ReapplyMealPlanDto } from './dto/reapply-meal-plan.dto';

type AuthRequest = Request & { user: { userId: string } };

@ApiTags('meal-plans')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('meal-plans')
export class MealPlansController {
  constructor(private readonly mealPlans: MealPlansService) {}

  @Get()
  list(@Req() req: AuthRequest, @Query('date') date?: string) {
    return this.mealPlans.list(req.user.userId, date);
  }

  @Get('history')
  history(@Req() req: AuthRequest, @Query('q') q?: string) {
    return this.mealPlans.listHistory(req.user.userId, q);
  }

  @Post('generate')
  generate(@Req() req: AuthRequest, @Body() dto: GenerateMealPlanDto) {
    return this.mealPlans.generate(req.user.userId, dto);
  }

  @Get('versions/:versionId')
  getVersion(@Req() req: AuthRequest, @Param('versionId') versionId: string) {
    return this.mealPlans.getVersion(versionId, req.user.userId);
  }

  @Post('versions/:versionId/swap')
  swap(
    @Req() req: AuthRequest,
    @Param('versionId') versionId: string,
    @Body() dto: SwapMealsDto,
  ) {
    return this.mealPlans.swapMeals(versionId, req.user.userId, dto);
  }

  @Post('versions/:versionId/meals/:mealId/alternative')
  selectAlternative(
    @Req() req: AuthRequest,
    @Param('versionId') versionId: string,
    @Param('mealId') mealId: string,
    @Body() dto: SelectAlternativeDto,
  ) {
    return this.mealPlans.selectAlternative(
      versionId,
      req.user.userId,
      mealId,
      dto.recipeId,
    );
  }

  @Post('versions/:versionId/reorder')
  reorder(
    @Req() req: AuthRequest,
    @Param('versionId') versionId: string,
    @Body() dto: ReorderMealsDto,
  ) {
    return this.mealPlans.reorderMeals(
      versionId,
      req.user.userId,
      dto.dayIndex,
      dto.mealIds,
    );
  }

  @Post('versions/:versionId/meals/:mealId/regenerate')
  regenerateMeal(
    @Req() req: AuthRequest,
    @Param('versionId') versionId: string,
    @Param('mealId') mealId: string,
  ) {
    return this.mealPlans.regenerateMeal(versionId, req.user.userId, mealId);
  }

  @Post('versions/:versionId/meals/:mealId/replace-recipe')
  replaceMealRecipe(
    @Req() req: AuthRequest,
    @Param('versionId') versionId: string,
    @Param('mealId') mealId: string,
    @Body() dto: ReplaceMealRecipeDto,
  ) {
    return this.mealPlans.replaceMealWithRecipe(
      versionId,
      req.user.userId,
      mealId,
      dto,
    );
  }

  @Post('versions/:versionId/confirm-recipes')
  confirmRecipes(
    @Req() req: AuthRequest,
    @Param('versionId') versionId: string,
  ) {
    return this.mealPlans.confirmVersionRecipes(versionId, req.user.userId);
  }

  @Post('versions/:versionId/meals/:mealId/log-eaten')
  logMealEaten(
    @Req() req: AuthRequest,
    @Param('versionId') versionId: string,
    @Param('mealId') mealId: string,
  ) {
    return this.mealPlans.logMealEaten(versionId, req.user.userId, mealId);
  }

  @Post('versions/:versionId/meals/:mealId/unlog-eaten')
  unlogMealEaten(
    @Req() req: AuthRequest,
    @Param('versionId') versionId: string,
    @Param('mealId') mealId: string,
  ) {
    return this.mealPlans.unlogMealEaten(versionId, req.user.userId, mealId);
  }

  @Post('versions/:versionId/days/:dayIndex/log-all-eaten')
  logAllMealsForDay(
    @Req() req: AuthRequest,
    @Param('versionId') versionId: string,
    @Param('dayIndex') dayIndex: string,
  ) {
    return this.mealPlans.logAllMealsForDay(
      versionId,
      req.user.userId,
      Number(dayIndex),
    );
  }

  @Post('versions/:versionId/days/:dayIndex/unlog-all-eaten')
  unlogAllMealsForDay(
    @Req() req: AuthRequest,
    @Param('versionId') versionId: string,
    @Param('dayIndex') dayIndex: string,
  ) {
    return this.mealPlans.unlogAllMealsForDay(
      versionId,
      req.user.userId,
      Number(dayIndex),
    );
  }

  @Patch('versions/:versionId/meals/:mealId')
  updateMeal(
    @Req() req: AuthRequest,
    @Param('versionId') versionId: string,
    @Param('mealId') mealId: string,
    @Body() dto: UpdateMealSlotDto,
  ) {
    return this.mealPlans.updateMealSlot(
      versionId,
      req.user.userId,
      mealId,
      dto,
    );
  }

  @Post('versions/:versionId/meals')
  addManualMeal(
    @Req() req: AuthRequest,
    @Param('versionId') versionId: string,
    @Body() dto: AddManualMealDto,
  ) {
    return this.mealPlans.addManualMeal(versionId, req.user.userId, {
      dayIndex: dto.dayIndex,
      mealType: dto.mealType,
      scheduledAt: dto.scheduledAt,
      title: dto.title,
      recipeId: dto.recipeId,
      nutrition: {
        calories: dto.calories,
        protein: dto.protein,
        carbs: dto.carbs,
        fats: dto.fats,
      },
    });
  }

  @Post(':planId/reapply')
  reapply(
    @Req() req: AuthRequest,
    @Param('planId') planId: string,
    @Body() dto: ReapplyMealPlanDto,
  ) {
    return this.mealPlans.reapplyPlan(planId, req.user.userId, dto.startDate);
  }

  @Get(':id')
  get(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.mealPlans.getPlan(id, req.user.userId);
  }

  @Post(':planId/versions/:versionId/restore')
  restore(
    @Req() req: AuthRequest,
    @Param('planId') planId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.mealPlans.restoreVersion(planId, versionId, req.user.userId);
  }
}
