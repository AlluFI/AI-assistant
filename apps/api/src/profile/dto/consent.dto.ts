import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsString, MaxLength } from 'class-validator';

const CONSENT_TYPES = [
  'data_collection',
  'ai_processing',
  'analytics',
  'marketing_email',
] as const;

export class ConsentDto {
  @ApiProperty({ enum: CONSENT_TYPES })
  @IsString()
  @IsIn(CONSENT_TYPES)
  consentType!: string;

  @ApiProperty()
  @IsBoolean()
  granted!: boolean;

  @ApiProperty({ default: 'user_settings' })
  @IsString()
  @MaxLength(60)
  source!: string;
}
