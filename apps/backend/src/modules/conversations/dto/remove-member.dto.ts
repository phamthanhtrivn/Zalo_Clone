import { IsNotEmpty, IsString } from 'class-validator';

export class RemoveMemberDto {
  @IsString()
  @IsNotEmpty()
  targetUserId: string;
}
