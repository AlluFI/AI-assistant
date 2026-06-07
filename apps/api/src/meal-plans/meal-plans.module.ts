import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { NutritionModule } from '../nutrition/nutrition.module';
import { RagModule } from '../rag/rag.module';
import { NutritionToolsModule } from '../nutrition-tools/nutrition-tools.module';
import { EnhancedNutritionModule } from '../enhanced-nutrition/enhanced-nutrition.module';
import { MealPlansController } from './meal-plans.controller';
import { MealPlansService } from './meal-plans.service';
import { MealPlanGenerationService } from './meal-plan-generation.service';

@Module({
  imports: [
    AuthModule,
    NutritionModule,
    RagModule,
    NutritionToolsModule,
    EnhancedNutritionModule,
    AiModule,
  ],
  controllers: [MealPlansController],
  providers: [MealPlansService, MealPlanGenerationService],
  exports: [MealPlansService, MealPlanGenerationService],
})
export class MealPlansModule {}
