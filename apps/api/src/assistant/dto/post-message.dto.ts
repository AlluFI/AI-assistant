import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const COACHING_MODES = ['balanced', 'nutrition', 'wellness'] as const;

export class PostAssistantMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  content!: string;

  @ApiPropertyOptional({ enum: COACHING_MODES })
  @IsOptional()
  @IsString()
  @IsIn(COACHING_MODES)
  coachingMode?: (typeof COACHING_MODES)[number];
}
