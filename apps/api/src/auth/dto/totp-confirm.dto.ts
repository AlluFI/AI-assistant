import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class TotpConfirmDto {
  @ApiProperty({ description: '6-digit code from your authenticator app' })
  @IsString()
  @Length(6, 6)
  code!: string;
}
