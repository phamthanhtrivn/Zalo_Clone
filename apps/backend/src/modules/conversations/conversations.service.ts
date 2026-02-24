import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Conversation } from './schemas/conversation.schema';
import { Model } from 'mongoose';
import { Member } from '../members/schemas/member.schema';
import { CreateGroupDto } from './dto/create-group.dto';
import { ConversationType, MemberRole } from '@zalo-clone/shared-types';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name)
    private conversationModel: Model<Conversation>,
    @InjectModel(Member.name) private memberModel: Model<Member>,
  ) {}

  async createGroup(creatorId: string, dto: CreateGroupDto) {
    const uniqueMemberIds = [...new Set(dto.memberIds)];
    if (uniqueMemberIds.includes(creatorId)) {
      throw new BadRequestException(
        'Danh sách thành viên không được chứa người tạo',
      );
    }

    const newConversation = new this.conversationModel({
      type: ConversationType.GROUP,
      group: {
        name: dto.name,
        avatarUrl: dto.avatarUrl || '',
        allowMembersInvite: true,
        allowMembersSendMessages: true,
      },
      lastMessageAt: new Date(),
    });

    const savedConsersation = await newConversation.save();

    const creatorMember = {
      conversationId: savedConsersation._id,
      userId: creatorId,
      role: MemberRole.OWNER,
      joinedAt: new Date(),
    };

    const otherMembers = uniqueMemberIds.map((memberId) => ({
      conversationId: savedConsersation._id,
      userId: memberId,
      role: MemberRole.MEMBER,
      joinedAt: new Date(),
    }));

    const allMembers = [creatorMember, ...otherMembers];

    try {
      await this.memberModel.insertMany(allMembers);
    } catch (error) {
      await this.conversationModel.findByIdAndDelete(savedConsersation._id);
      throw new BadRequestException(
        'Không thể thêm thành viên vào nhóm. Vui lòng tạo lại nhóm mới.',
      );
    }

    return {
      success: true,
      message: 'Tạo nhóm thành công',
      data: {
        conversation: savedConsersation,
        totalMembers: allMembers.length,
      },
    };
  }
}
