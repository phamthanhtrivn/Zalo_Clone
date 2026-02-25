import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Conversation } from './schemas/conversation.schema';
import { Model } from 'mongoose';
import { Member } from '../members/schemas/member.schema';
import { CreateGroupDto } from './dto/create-group.dto';
import { ConversationType, MemberRole } from '@zalo-clone/shared-types';
import { Message } from '../messages/schemas/message.schema';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name)
    private conversationModel: Model<Conversation>,
    @InjectModel(Member.name) private memberModel: Model<Member>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
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

  async deleteGroup(conversetionId: string, userId: string) {
    const conversetion = await this.conversationModel.findById(conversetionId);

    if (!conversetion) {
      throw new NotFoundException('Nhóm trò chuyện không tồn tại');
    }

    if (conversetion.type !== ConversationType.GROUP) {
      throw new BadRequestException('Chỉ áp dụng cho nhóm chat');
    }

    const owner = await this.memberModel.findOne({
      conversationId: conversetion._id,
      userId: userId,
    });

    if (!owner || owner.role !== MemberRole.OWNER) {
      throw new ForbiddenException(
        'Chỉ trưởng nhóm mới có quyền giải tán nhóm',
      );
    }

    try {
      // Xoá tất cả member
      await this.memberModel.deleteMany({ conversationId: conversetion._id });
      // Xoá tất cả tin nhắn
      await this.messageModel.deleteMany({ conversationId: conversetion._id });
      // Xoá nhóm chat
      await this.conversationModel.findByIdAndDelete(conversetionId);

      return {
        success: true,
        message: 'Giải tán nhóm thành công'
      }
    } catch (error) {
      throw new BadRequestException('Lỗi khi giải tán nhóm')
    }
  }
}
