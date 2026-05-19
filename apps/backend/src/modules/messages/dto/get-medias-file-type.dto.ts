import { IsIn, IsMongoId, IsNumberString, IsOptional } from 'class-validator';
import { FileType } from 'src/common/types/enums/file-type';

export class GetMediasFileTypeDto {
  @IsMongoId()
  userId: string;
  @IsOptional()
  @IsIn([...Object.values(FileType), 'LINK'])
  type?: FileType | 'LINK';
  @IsOptional()
  @IsMongoId()
  cursor?: string;
  @IsOptional()
  @IsNumberString()
  limit?: string;
  @IsOptional()
  senderId?: string;
  @IsOptional()
  fromDate?: string;
  @IsOptional()
  toDate?: string;
}
