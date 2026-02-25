import { IsMongoId } from 'class-validator';

export class ReadReceiptDto {
  @IsMongoId()
  userId: string;
  @IsMongoId()
  messageId: string;
  @IsMongoId()
  conversationId: string;
}
