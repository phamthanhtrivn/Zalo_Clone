import { IsMongoId } from 'class-validator';

export class PinnedMessageDto {
  @IsMongoId()
  userId: string;
  @IsMongoId()
  messageId: string;
  @IsMongoId()
  conversationId: string;
}
