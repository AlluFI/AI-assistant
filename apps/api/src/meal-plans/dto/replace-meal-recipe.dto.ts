import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class ReplaceMealRecipeDto {
  @ApiProperty()
  @IsString()
  recipeId!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0.25)
  @Max(10)
  servings?: number;

  /** When true, regenerate other meals on the same day and rebalance to daily targets. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  replanDay?: boolean;

  /** When true, return projected day totals without persisting changes. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  preview?: boolean;
}
