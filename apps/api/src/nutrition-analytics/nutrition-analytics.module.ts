import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { NutritionModule } from '../nutrition/nutrition.module';
import { NutritionAnalyticsController } from './nutrition-analytics.controller';
import { NutritionAnalyticsService } from './nutrition-analytics.service';

@Module({
  imports: [AuthModule, NutritionModule, AiModule],
  controllers: [NutritionAnalyticsController],
  providers: [NutritionAnalyticsService],
  exports: [NutritionAnalyticsService],
})
export class NutritionAnalyticsModule {}
