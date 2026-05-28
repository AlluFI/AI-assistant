import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

export class ResetStartingWeightDto {
  @ApiProperty({ description: 'New starting weight in kilograms' })
  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(400)
  startingWeightKg!: number;
}
