import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NutritionToolsModule } from '../nutrition-tools/nutrition-tools.module';
import { GeminiVisionService } from './gemini-vision.service';
import { MealPhotosController } from './meal-photos.controller';
import { MealPhotosService } from './meal-photos.service';

@Module({
  imports: [AuthModule, NutritionToolsModule],
  controllers: [MealPhotosController],
  providers: [GeminiVisionService, MealPhotosService],
  exports: [MealPhotosService, GeminiVisionService],
})
export class MealPhotosModule {}
