import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsString, Min } from 'class-validator';

export class ReorderMealsDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  dayIndex!: number;

  @ApiProperty({
    type: [String],
    description: 'Meal ids in desired order for this day',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  mealIds!: string[];
}
