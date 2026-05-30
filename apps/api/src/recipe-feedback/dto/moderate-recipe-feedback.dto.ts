import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class ModerateRecipeFeedbackDto {
  @ApiProperty({ enum: ['approved', 'rejected'] })
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';
}
