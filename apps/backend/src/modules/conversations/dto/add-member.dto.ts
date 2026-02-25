import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class AddMemberDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  userIds: string[];
}
