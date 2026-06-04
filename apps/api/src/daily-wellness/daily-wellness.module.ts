import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuthModule } from '../auth/auth.module';
import { NutritionModule } from '../nutrition/nutrition.module';
import { NutritionAnalyticsModule } from '../nutrition-analytics/nutrition-analytics.module';
import { NutritionToolsModule } from '../nutrition-tools/nutrition-tools.module';
import { DailyCheckInService } from './daily-check-in.service';
import { DailyWellnessController } from './daily-wellness.controller';
import { FoodLogService } from './food-log.service';
import { TodayService } from './today.service';

@Module({
  imports: [
    AuthModule,
    NutritionModule,
    NutritionAnalyticsModule,
    NutritionToolsModule,
    AnalyticsModule,
  ],
  controllers: [DailyWellnessController],
  providers: [TodayService, DailyCheckInService, FoodLogService],
  exports: [TodayService, DailyCheckInService, FoodLogService],
})
export class DailyWellnessModule {}
