import { IsMongoId, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ContentDto } from './content.dto';
import { CallDto } from './call.dto';

export class SendMessageDto {
  @IsMongoId()
  senderId: string;
  @IsMongoId()
  conversationId: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => ContentDto)
  content?: ContentDto;
  @IsOptional()
  @IsMongoId()
  repliedId?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => CallDto)
  call?: CallDto;
}
