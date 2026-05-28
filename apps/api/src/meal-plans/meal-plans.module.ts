import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { NutritionModule } from '../nutrition/nutrition.module';
import { RagModule } from '../rag/rag.module';
import { NutritionToolsModule } from '../nutrition-tools/nutrition-tools.module';
import { MealPlansController } from './meal-plans.controller';
import { MealPlansService } from './meal-plans.service';

@Module({
  imports: [
    AuthModule,
    NutritionModule,
    RagModule,
    NutritionToolsModule,
    AiModule,
  ],
  controllers: [MealPlansController],
  providers: [MealPlansService],
  exports: [MealPlansService],
})
export class MealPlansModule {}
