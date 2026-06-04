import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsObject, IsString } from 'class-validator';

const ACTIONS = [
  'confirm_log_activity',
  'confirm_log_weight',
  'confirm_regenerate_meal',
  'confirm_generate_shopping_list',
  'confirm_mark_meal_eaten',
  'confirm_generate_meal_plan',
  'confirm_onboarding_skip',
  'confirm_onboarding_ai_targets',
  'confirm_onboarding_formula_targets',
  'confirm_onboarding_meal_defaults',
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
