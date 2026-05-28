import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ChangeEmailRequestDto {
  @ApiProperty({ example: 'new-email@example.com' })
  @IsEmail()
  newEmail!: string;
}
