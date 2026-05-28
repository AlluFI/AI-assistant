import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RecipesService } from './recipes.service';
import { RecipeSearchDto } from './dto/recipe-search.dto';
import { ScaleRecipeDto } from './dto/scale-recipe.dto';
import { SubstituteIngredientDto } from './dto/substitute-ingredient.dto';

type AuthRequest = Request & { user: { userId: string } };

@ApiTags('recipes')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipes: RecipesService) {}

  @Get()
  search(@Req() _req: AuthRequest, @Query() dto: RecipeSearchDto) {
    return this.recipes.search(dto);
  }

  @Get(':id')
  get(@Req() _req: AuthRequest, @Param('id') id: string) {
    return this.recipes.getById(id);
  }

  @Post('scale')
  scale(@Req() _req: AuthRequest, @Body() dto: ScaleRecipeDto) {
    return this.recipes.scale(dto);
  }

  @Post(':id/substitute-ingredient')
  substituteIngredient(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: SubstituteIngredientDto,
  ) {
    return this.recipes.substituteIngredient(req.user.userId, id, dto);
  }
}
