import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class MetricUpdateDto {
  @ApiPropertyOptional({ description: 'Weight in kilograms' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(400)
  weightKg?: number;

  @ApiPropertyOptional({ description: 'ISO 8601 or YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  recordedAt?: string;
}
