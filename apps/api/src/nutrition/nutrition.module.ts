import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuthModule } from '../auth/auth.module';
import { NutritionController } from './nutrition.controller';
import { NutritionService } from './nutrition.service';
import { CalorieTargetService } from './calorie-target.service';

@Module({
  imports: [AuthModule, AnalyticsModule, AiModule],
  controllers: [NutritionController],
  providers: [NutritionService, CalorieTargetService],
  exports: [NutritionService, CalorieTargetService],
})
export class NutritionModule {}
