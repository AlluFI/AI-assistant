import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SelectAlternativeDto {
  @ApiProperty()
  @IsString()
  recipeId!: string;
}
