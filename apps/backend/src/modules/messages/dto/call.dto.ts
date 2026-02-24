import { CallStatus, CallType } from '@zalo-clone/shared-types';
import { IsEnum } from 'class-validator';

export class CallDto {
  @IsEnum(CallType)
  type: CallType;
  @IsEnum(CallStatus)
  status: CallStatus;
  endedAt: Date;
  duration: number;
}
