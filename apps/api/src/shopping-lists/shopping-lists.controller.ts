import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ShoppingListsService } from './shopping-lists.service';

type AuthRequest = Request & { user: { userId: string } };

@ApiTags('shopping-lists')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('shopping-lists')
export class ShoppingListsController {
  constructor(private readonly lists: ShoppingListsService) {}

  @Get('categories')
  categories() {
    return this.lists.categories();
  }

  @Get()
  list(@Req() req: AuthRequest) {
    return this.lists.list(req.user.userId);
  }

  @Post('from-version/:versionId')
  fromVersion(
    @Req() req: AuthRequest,
    @Param('versionId') versionId: string,
    @Body() body: { title?: string },
  ) {
    return this.lists.generateFromVersion(
      req.user.userId,
      versionId,
      body.title,
    );
  }

  @Post('from-meal/:versionId/:mealId')
  fromMeal(
    @Req() req: AuthRequest,
    @Param('versionId') versionId: string,
    @Param('mealId') mealId: string,
    @Body() body: { title?: string },
  ) {
    return this.lists.generateFromMeal(
      req.user.userId,
      versionId,
      mealId,
      body.title,
    );
  }

  @Patch(':listId/items/:itemId')
  updateItem(
    @Req() req: AuthRequest,
    @Param('listId') listId: string,
    @Param('itemId') itemId: string,
    @Body()
    body: { quantityGrams?: number; quantityMl?: number; excluded?: boolean },
  ) {
    return this.lists.updateItem(req.user.userId, listId, itemId, body);
  }

  @Delete(':listId/items/:itemId')
  removeItem(
    @Req() req: AuthRequest,
    @Param('listId') listId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.lists.deleteItem(req.user.userId, listId, itemId);
  }
}
