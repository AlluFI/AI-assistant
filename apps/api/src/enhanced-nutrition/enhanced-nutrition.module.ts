import { Module } from '@nestjs/common';
import { NutritionToolsModule } from '../nutrition-tools/nutrition-tools.module';
import { EnhancedNutritionService } from './enhanced-nutrition.service';

@Module({
  imports: [NutritionToolsModule],
  providers: [EnhancedNutritionService],
  exports: [EnhancedNutritionService],
})
export class EnhancedNutritionModule {}
