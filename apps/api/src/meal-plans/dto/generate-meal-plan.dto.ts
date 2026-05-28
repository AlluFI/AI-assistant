import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class GenerateMealPlanDto {
  @ApiProperty({ enum: ['daily', 'weekly'] })
  @IsIn(['daily', 'weekly'])
  duration!: 'daily' | 'weekly';

  @ApiProperty({ example: '2024-07-29' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate!: string;

  @ApiPropertyOptional({ example: '1.0' })
  @IsOptional()
  @IsString()
  version?: string;
}
