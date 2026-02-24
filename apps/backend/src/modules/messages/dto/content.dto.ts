import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { FileDto } from './file.dto';
import { Type } from 'class-transformer';

export class ContentDto {
  @IsOptional()
  @IsString()
  text?: string;
  @IsOptional()
  @IsString()
  icon?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => FileDto)
  file?: FileDto;
}
