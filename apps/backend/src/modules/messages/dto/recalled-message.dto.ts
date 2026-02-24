import { IsMongoId } from 'class-validator';

export class RecalledMessageDto {
  @IsMongoId()
  userId: string;
  @IsMongoId()
  messageId: string;
  @IsMongoId()
  conversationId: string;
}
