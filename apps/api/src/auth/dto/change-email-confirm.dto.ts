import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangeEmailConfirmDto {
  @ApiProperty({ minLength: 20 })
  @IsString()
  @MinLength(20)
  token!: string;
}
