/* eslint-disable prettier/prettier */

import { Body, Controller, Post } from '@nestjs/common';
import { MembersService } from './members.service';
import { Types } from 'mongoose';
@Controller('members')
export class MembersController {
    constructor(
        private readonly membersService: MembersService
    ) { }
    // Thêm thành viên
    @Post('add')
    async addMember(
        @Body('conversationId') conversationId: string,
        @Body('userIdToAdd') userIdToAdd: string,
        @Body('currentUserId') currentUserId: string,
    ) {
        return this.membersService.addMember(
            new Types.ObjectId(conversationId),
            new Types.ObjectId(userIdToAdd),
            new Types.ObjectId(currentUserId),
        );
    }
}
