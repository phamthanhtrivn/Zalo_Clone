import { EmojiType } from '@zalo-clone/shared-types/dist/enums/emoji-type';
import { IsEnum, IsMongoId } from 'class-validator';

export class ReactionDto {
  @IsMongoId()
  userId: string;
  @IsEnum(EmojiType)
  emojiType: EmojiType;
  @IsMongoId()
  messageId: string;
  @IsMongoId()
  conversationId: string;
}
