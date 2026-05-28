import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAssistantThreadDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;
}
