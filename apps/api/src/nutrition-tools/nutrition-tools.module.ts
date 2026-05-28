import { Module } from '@nestjs/common';
import { NutritionToolsService } from './nutrition-tools.service';
import { NutritionToolsController } from './nutrition-tools.controller';

@Module({
  controllers: [NutritionToolsController],
  providers: [NutritionToolsService],
  exports: [NutritionToolsService],
})
export class NutritionToolsModule {}
