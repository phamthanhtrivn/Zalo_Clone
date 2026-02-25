/* eslint-disable prettier/prettier */
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Member } from './schemas/member.schema';
import { MemberRole } from '@zalo-clone/shared-types';
@Injectable()
export class MembersService {
    constructor(
        @InjectModel(Member.name)
        private readonly memberModel: Model<Member>,
    ) { }
    // Thêm thành viên
    async addMember(
        conversationId: Types.ObjectId,
        userIdToAdd: Types.ObjectId,
        currentUserId: Types.ObjectId,
    ) {
        const currentMember = await this.memberModel.findOne({ conversationId, userId: currentUserId, leftAt: null })
        if (!currentMember) {
            throw new ForbiddenException('Bạn không phải là thành viên của cuộc hội thoại');

        }
        if (
            currentMember.role !== MemberRole.OWNER &&
            currentMember.role !== MemberRole.ADMIN
        ) {
            throw new ForbiddenException('Bạn không có quyền thêm thành viên');
        }
        const existing = await this.memberModel.findOne({ conversationId, userId: userIdToAdd })
        if (existing && !existing.leftAt) {
            throw new BadRequestException('Người dùng đã là thành viên của cuộc hội thoại');
        }
        if (existing && existing.leftAt) {
            existing.leftAt = null;
            existing.joinedAt = new Date();
            return existing.save();
        }
        return this.memberModel.create({
            conversationId,
            userId: userIdToAdd,
            role: MemberRole.MEMBER,
            nickName: null,
            joinedAt: new Date(),
        })

    }
}
