import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SubstituteIngredientDto {
  @ApiProperty({ example: 'olive oil' })
  @IsString()
  ingredient!: string;

  @ApiPropertyOptional({
    description:
      'Why substitution is needed (availability, allergy, preference).',
    example: 'availability',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of suggestions to return.',
    example: 3,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  limit?: number;
}
