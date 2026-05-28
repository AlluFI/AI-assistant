import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const GENDERS = [
  'female',
  'male',
  'non_binary',
  'prefer_not_say',
  'other',
] as const;
const ACTIVITY = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
] as const;
const GOALS = [
  'weight_loss',
  'muscle_gain',
  'general_fitness',
  'maintenance',
] as const;
const DURATION = ['15_30', '30_60', '60_plus'] as const;
const FITNESS = ['beginner', 'intermediate', 'advanced'] as const;
const ENV = ['home', 'gym', 'outdoors', 'mixed'] as const;
const TIME = ['morning', 'afternoon', 'evening', 'varies'] as const;

export class ProfileUpdateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  age?: number;

  @ApiPropertyOptional({ enum: GENDERS })
  @IsOptional()
  @IsString()
  @IsIn(GENDERS)
  gender?: string;

  @ApiPropertyOptional({ description: 'Height in centimeters' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(50)
  @Max(260)
  heightCm?: number;

  @ApiPropertyOptional({ description: 'Weight in kilograms' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(400)
  weightKg?: number;

  @ApiPropertyOptional({
    description:
      'Starting weight for progress charts (only applied before the first baseline is created)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(400)
  startingWeightKg?: number;

  @ApiPropertyOptional({ description: 'Target weight in kilograms' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(400)
  targetWeightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  occupationType?: string;

  @ApiPropertyOptional({ enum: ACTIVITY })
  @IsOptional()
  @IsString()
  @IsIn(ACTIVITY)
  activityLevel?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dietaryPreferences?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dietaryRestrictions?: string[];

  @ApiPropertyOptional({ enum: GOALS })
  @IsOptional()
  @IsString()
  @IsIn(GOALS)
  fitnessGoalPrimary?: string;

  @ApiPropertyOptional({ enum: ACTIVITY })
  @IsOptional()
  @IsString()
  @IsIn(ACTIVITY)
  desiredActivityLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(7)
  weeklyActivityDays?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  exerciseTypes?: string[];

  @ApiPropertyOptional({ enum: DURATION })
  @IsOptional()
  @IsString()
  @IsIn(DURATION)
  sessionDurationBand?: string;

  @ApiPropertyOptional({ enum: FITNESS })
  @IsOptional()
  @IsString()
  @IsIn(FITNESS)
  fitnessSelfLevel?: string;

  @ApiPropertyOptional({ enum: ENV })
  @IsOptional()
  @IsString()
  @IsIn(ENV)
  exerciseEnvironment?: string;

  @ApiPropertyOptional({ enum: TIME })
  @IsOptional()
  @IsString()
  @IsIn(TIME)
  exerciseTimeOfDay?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(600)
  enduranceMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(500)
  pushupsMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(500)
  squatsMax?: number;
}
