import { CallType } from '@zalo-clone/shared-types';
import { IsEnum, IsMongoId } from 'class-validator';

export class CallMessageDto {
  @IsMongoId()
  senderId: string;
  @IsMongoId()
  conversationId: string;

  @IsEnum(CallType)
  type: CallType;
}
