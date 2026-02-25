import { MemberRole } from "@zalo-clone/shared-types";
import { ArrayNotEmpty, IsArray, IsEnum, IsString } from "class-validator";


export class UpdateMemberRoleDto {
    @IsArray()
    @ArrayNotEmpty()
    @IsString({each: true})
    memberIds: string[]

    @IsEnum(MemberRole)
    newRole: MemberRole

}