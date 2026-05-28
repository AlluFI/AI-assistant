import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AddManualMealDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  dayIndex!: number;

  @ApiProperty({ example: 'lunch' })
  @IsString()
  mealType!: string;

  @ApiProperty({ description: 'ISO 8601 datetime' })
  @IsString()
  scheduledAt!: string;

  @ApiProperty({ example: 'Custom protein bowl' })
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recipeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  calories?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  protein?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  carbs?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fats?: number;
}
