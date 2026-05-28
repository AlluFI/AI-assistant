import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class ActivityRecordDto {
  @ApiProperty({
    description: 'Activity type code from GET /profile/activities/catalog',
  })
  @IsString()
  @IsIn(TYPE_CODES)
  activityType!: string;

  @ApiProperty({ description: 'Duration in minutes' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  durationMinutes!: number;

  @ApiPropertyOptional({
    description: 'ISO 8601 or YYYY-MM-DD; defaults to now',
  })
  @IsOptional()
  @IsString()
  activityAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
