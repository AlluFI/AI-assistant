import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MinLength } from 'class-validator';

export class MfaCompleteDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  mfaToken!: string;

  @ApiProperty({ required: false, description: '6-digit TOTP code' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  totpCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(8)
  backupCode?: string;
}
