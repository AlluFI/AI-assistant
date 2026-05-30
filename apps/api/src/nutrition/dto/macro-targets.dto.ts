import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class MacroTargetsDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  protein!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  carbs!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fats!: number;
}
