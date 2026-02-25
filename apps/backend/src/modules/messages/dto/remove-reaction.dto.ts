import { IsMongoId } from 'class-validator';

export class RemoveReactionDto {
  @IsMongoId()
  userId: string;
  @IsMongoId()
  messageId: string;
  @IsMongoId()
  conversationId: string;
}
