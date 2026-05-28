import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class BackupRegenerateDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  password!: string;
}
