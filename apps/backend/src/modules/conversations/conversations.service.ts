import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Conversation } from './schemas/conversation.schema';
import { Connection, Model } from 'mongoose';
import { Member } from '../members/schemas/member.schema';
import { CreateGroupDto } from './dto/create-group.dto';
import { ConversationType, MemberRole } from '@zalo-clone/shared-types';
import { Message } from '../messages/schemas/message.schema';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { TransferOwnerDto } from './dto/transfer-owenr.dto';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name)
    private conversationModel: Model<Conversation>,
    @InjectModel(Member.name) private memberModel: Model<Member>,
    @InjectModel(Message.name) private messageModel: Model<Message>,

    @InjectConnection() private connection: Connection,
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

  async deleteGroup(conversationId: string, userId: string) {
    const conversation = await this.conversationModel.findById(conversationId);

    if (!conversation) {
      throw new NotFoundException('Nhóm trò chuyện không tồn tại');
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new BadRequestException('Chỉ áp dụng cho nhóm chat');
    }

    const owner = await this.memberModel.findOne({
      conversationId: conversation._id,
      userId: userId,
    });

    if (!owner || owner.role !== MemberRole.OWNER) {
      throw new ForbiddenException(
        'Chỉ trưởng nhóm mới có quyền giải tán nhóm',
      );
    }

    try {
      // Xoá tất cả member
      await this.memberModel.deleteMany({ conversationId: conversation._id });
      // Xoá tất cả tin nhắn
      await this.messageModel.deleteMany({ conversationId: conversation._id });
      // Xoá nhóm chat
      await this.conversationModel.findByIdAndDelete(conversationId);

      return {
        success: true,
        message: 'Giải tán nhóm thành công',
      };
    } catch (error) {
      throw new BadRequestException('Lỗi khi giải tán nhóm');
    }
  }

  async updateMembersRole(
    conversationId: string,
    actorId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Nhóm trò chuyện không tồn tại');
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new BadRequestException('Chỉ áp dụng cho nhóm chat');
    }

    const owner = await this.memberModel.findOne({
      conversationId: conversation._id,
      userId: actorId,
    });

    if (!owner || owner.role !== MemberRole.OWNER) {
      throw new ForbiddenException('Chỉ trưởng nhóm mới có quyền phân quyền');
    }

    const targetIds = dto.memberIds.filter((id) => id !== actorId);

    if (targetIds.length === 0) {
      throw new BadRequestException('Vui lòng chọn thành viên để phân quyền');
    }

    if (dto.newRole === MemberRole.OWNER) {
      throw new BadRequestException(
        'Vui lòng chọn chức năng chuyển nhượng nhớm trưởng riêng',
      );
    }

    const result = await this.memberModel.updateMany(
      {
        conversationId: conversation._id,
        userId: { $in: targetIds },
      },
      {
        $set: { role: dto.newRole },
      },
    );

    if (result.matchedCount === 0) {
      throw new NotFoundException(
        'Không tìm thấy thành viên nào trong nhóm để cập nhật',
      );
    }

    return {
      success: true,
      message: `Đã cập nhật quyền cho ${result.modifiedCount} thành viên`,
      data: {
        updateCount: result.modifiedCount,
        newRole: dto.newRole,
      },
    };
  }

  async transferOwner(
    conversationId: string,
    currentOwnerId: string,
    dto: TransferOwnerDto,
  ) {
    const session = await this.connection.startSession();

    session.startTransaction();

    try {
      const conversation =
        await this.conversationModel.findById(conversationId);
      if (!conversation) {
        throw new NotFoundException('Nhóm trò chuyện không tồn tại');
      }

      if (conversation.type !== ConversationType.GROUP) {
        throw new BadRequestException('Chỉ áp dụng cho nhóm chat');
      }

      if (currentOwnerId === dto.targetUserId) {
        throw new BadRequestException('Bạn đã là trưởng nhóm rồi');
      }

      const currentOwnerMember = await this.memberModel.findOne({
        conversationId: conversation._id,
        userId: currentOwnerId,
      });

      if (!currentOwnerMember || currentOwnerMember.role !== MemberRole.OWNER) {
        throw new ForbiddenException(
          'Chỉ trưởng nhóm mới có quyền chuyển nhượng',
        );
      }

      const targetMember = await this.memberModel.findOne({
        conversationId: conversation._id,
        userId: dto.targetUserId,
      });

      if (!targetMember) {
        throw new NotFoundException(
          'Thành viên được chỉ định không tồn tại trong nhóm',
        );
      }

      await this.memberModel
        .updateOne(
          { _id: targetMember._id },
          { $set: { role: MemberRole.OWNER } },
        )
        .session(session);

      await this.memberModel
        .updateOne(
          { _id: currentOwnerMember._id },
          { $set: { role: MemberRole.MEMBER } },
        )
        .session(session);

      await session.commitTransaction();

      return {
        success: true,
        message: 'Chuyển nhượng trưởng nhóm thành công',
        data: {
          newOwnerId: targetMember._id,
          oldOwnerId: currentOwnerMember._id,
        },
      };
    } catch (error) {
      await session.abortTransaction();

      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      console.error('Lỗi chuyển nhượng nhóm trưởng', error)
      throw new InternalServerErrorException('Lỗi hệ thống khi chuyển nhượng quyền')
    } finally{
      await session.endSession()
    }
  }
}
