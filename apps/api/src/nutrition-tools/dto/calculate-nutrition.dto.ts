import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class IngredientQuantityDto {
  @ApiProperty()
  @IsString()
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

export class CalculateNutritionDto {
  @ApiProperty({ type: [IngredientQuantityDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => IngredientQuantityDto)
  ingredients!: IngredientQuantityDto[];

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  servings!: number;
}
