import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

const COACHING_MODES = ['balanced', 'nutrition', 'wellness', 'onboarding'] as const;

export class PatchAssistantThreadDto {
  @ApiPropertyOptional({ enum: COACHING_MODES })
  @IsOptional()
  @IsString()
  @IsIn(COACHING_MODES)
  coachingMode?: (typeof COACHING_MODES)[number];
}
