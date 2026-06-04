import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { MealPlansModule } from '../meal-plans/meal-plans.module';
import { NutritionModule } from '../nutrition/nutrition.module';
import { NutritionAnalyticsModule } from '../nutrition-analytics/nutrition-analytics.module';
import { ProfileModule } from '../profile/profile.module';
import { RecipesModule } from '../recipes/recipes.module';
import { ShoppingListsModule } from '../shopping-lists/shopping-lists.module';
import { AssistantController } from './assistant.controller';
import { AssistantToolsService } from './assistant-tools.service';
import { AssistantWingmanService } from './assistant-wingman.service';
import { AssistantService } from './assistant.service';
import { ThreadSummaryService } from './thread-summary.service';
import { UserMemoryService } from './user-memory.service';

@Module({
  imports: [
    AiModule,
    ProfileModule,
    AnalyticsModule,
    NutritionModule,
    NutritionAnalyticsModule,
    MealPlansModule,
    RecipesModule,
    ShoppingListsModule,
  ],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    AssistantToolsService,
    AssistantWingmanService,
    ThreadSummaryService,
    UserMemoryService,
  ],
  exports: [AssistantService],
})
export class AssistantModule {}
