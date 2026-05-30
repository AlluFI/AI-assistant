import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { NutritionModule } from '../nutrition/nutrition.module';
import { RagModule } from '../rag/rag.module';
import { NutritionToolsModule } from '../nutrition-tools/nutrition-tools.module';
import { EnhancedNutritionModule } from '../enhanced-nutrition/enhanced-nutrition.module';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';

@Module({
  imports: [
    AuthModule,
    RagModule,
    NutritionToolsModule,
    EnhancedNutritionModule,
    AiModule,
    NutritionModule,
  ],
  controllers: [RecipesController],
  providers: [RecipesService],
  exports: [RecipesService],
})
export class RecipesModule {}
