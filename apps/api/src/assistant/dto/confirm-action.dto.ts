import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsObject, IsString } from 'class-validator';

const ACTIONS = [
  'confirm_log_activity',
  'confirm_log_weight',
  'confirm_regenerate_meal',
  'confirm_generate_shopping_list',
] as const;

export class ConfirmAssistantActionDto {
  @ApiProperty({ enum: ACTIONS })
  @IsString()
  @IsIn(ACTIONS)
  action!: (typeof ACTIONS)[number];

  @ApiProperty({
    description:
      'Action-specific payload (activityType, durationMinutes, etc.)',
  })
  @IsObject()
  payload!: Record<string, unknown>;
}
