import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SwapMealsDto {
  @ApiProperty()
  @IsString()
  mealIdA!: string;

  @ApiProperty()
  @IsString()
  mealIdB!: string;
}
