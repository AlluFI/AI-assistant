import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, Min } from 'class-validator';

export class ScaleRecipeDto {
  @ApiProperty()
  @IsString()
  recipeId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  servings!: number;
}
