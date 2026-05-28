import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class PurgeDueDto {
  @ApiProperty({ description: 'Admin purge secret from server env' })
  @IsString()
  @MinLength(12)
  secret!: string;
}
