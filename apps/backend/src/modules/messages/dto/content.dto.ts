import { IsOptional, IsString } from 'class-validator';

export class ContentDto {
  @IsOptional()
  @IsString()
  text?: string;
  @IsOptional()
  @IsString()
  icon?: string;
}
