import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class GenerateInsightDto {
  @ApiPropertyOptional({
    description: 'How many past days of metrics to include in AI context',
    default: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(180)
  historyDays?: number;
}
