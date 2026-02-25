import { IsNotEmpty, IsString } from 'class-validator';

export class TransferOwnerDto {
  @IsString()
  @IsNotEmpty()
  targetUserId: string;
}
