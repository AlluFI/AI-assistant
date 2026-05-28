import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class PrivacyUpdateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowAiProcessing?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  publicProfileVisible?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  shareAnonymizedData?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional({ enum: ['off', 'daily', 'weekly'] })
  @IsOptional()
  @IsIn(['off', 'daily', 'weekly'])
  insightCadence?: 'off' | 'daily' | 'weekly';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  weightReminderEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activityReminderEnabled?: boolean;

  @ApiPropertyOptional({ enum: ['email', 'in_app'] })
  @IsOptional()
  @IsIn(['email', 'in_app'])
  reminderChannel?: 'email' | 'in_app';

  @ApiPropertyOptional({ enum: ['off', 'daily', 'weekly'] })
  @IsOptional()
  @IsIn(['off', 'daily', 'weekly'])
  activityReminderCadence?: 'off' | 'daily' | 'weekly';
}
