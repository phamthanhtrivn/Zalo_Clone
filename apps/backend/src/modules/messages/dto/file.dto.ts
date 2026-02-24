import { FileType } from '@zalo-clone/shared-types';
import { IsEnum, IsNumber, IsString } from 'class-validator';

export class FileDto {
  @IsString()
  fileName: string;
  @IsString()
  fileUrl: string;
  @IsNumber()
  fileSize: number;
  @IsEnum(FileType)
  type: FileType;
}
