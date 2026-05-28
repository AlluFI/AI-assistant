import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ACTIVITY_TYPE_CODES } from '../activity-catalog';

const TYPE_CODES = [...ACTIVITY_TYPE_CODES] as [string, ...string[]];

export class ActivityUpdateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(TYPE_CODES)
  activityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  activityAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
