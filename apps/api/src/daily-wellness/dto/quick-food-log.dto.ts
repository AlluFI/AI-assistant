import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class QuickIngredientDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  quantity!: number;

  @ApiPropertyOptional({ enum: ['gram', 'milliliter'] })
  @IsOptional()
  @IsIn(['gram', 'milliliter'])
  unit?: 'gram' | 'milliliter';
}

export class QuickFoodLogDto {
  @ApiProperty({ example: 'Greek yogurt snack' })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @ApiPropertyOptional({ enum: ['breakfast', 'lunch', 'dinner', 'snack'] })
  @IsOptional()
  @IsIn(['breakfast', 'lunch', 'dinner', 'snack'])
  mealType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recipeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.25)
  servings?: number;

  @ApiPropertyOptional({ type: [QuickIngredientDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuickIngredientDto)
  ingredients?: QuickIngredientDto[];
}
