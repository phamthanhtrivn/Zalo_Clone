import { CallStatus } from '@zalo-clone/shared-types';
import { IsEnum, IsMongoId } from 'class-validator';

export class UpdateCallMessageDto {
  @IsMongoId()
  messageId: string;
  @IsEnum(CallStatus)
  status: CallStatus;
}
