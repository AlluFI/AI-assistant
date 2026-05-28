import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class NutritionProfileUpdateDto {
  @ApiPropertyOptional({ example: 'Europe/Helsinki' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dislikedIngredients?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cuisinePreferences?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(800)
  @Max(6000)
  calorieTarget?: number;

  @ApiPropertyOptional({ enum: ['computed', 'manual', 'ai_suggested'] })
  @IsOptional()
  @IsString()
  calorieTargetSource?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  macroTargets?: { protein: number; carbs: number; fats: number };

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(6)
  mealsPerDay?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4)
  snacksPerDay?: number;

  @ApiPropertyOptional({
    description: 'ISO 8601 meal times keyed by meal type',
    example: {
      breakfast: '2024-01-01T08:00:00.000Z',
      lunch: '2024-01-01T12:30:00.000Z',
      dinner: '2024-01-01T19:00:00.000Z',
    },
  })
  @IsOptional()
  @IsObject()
  preferredMealTimes?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Mark nutrition preferences as confirmed',
  })
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}
