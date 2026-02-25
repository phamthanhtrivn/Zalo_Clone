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
import { RemoveMemberDto } from './dto/remove-member.dto';
import { AddMemberDto } from './dto/add-member.dto';
import e from 'express';

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

      console.error('Lỗi chuyển nhượng nhóm trưởng', error);
      throw new InternalServerErrorException(
        'Lỗi hệ thống khi chuyển nhượng quyền',
      );
    } finally {
      await session.endSession();
    }
  }

  async removeMember(
    conversationId: string,
    actorId: string,
    dto: RemoveMemberDto,
  ) {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Nhóm trò chuyện không tồn tại');
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new BadRequestException('Chỉ áp dụng cho nhóm chat');
    }

    if (actorId === dto.targetUserId) {
      throw new BadRequestException('Vui lòng sử dụng tính năng rời nhóm');
    }

    const actorMember = await this.memberModel.findOne({
      conversationId: conversation._id,
      userId: actorId,
    });

    if (!actorMember) {
      throw new ForbiddenException('Bạn không phải là thành viên của nhóm này');
    }

    if (actorMember.role === MemberRole.MEMBER) {
      throw new ForbiddenException('Bạn không có quyền xoá thành viên');
    }

    const targetMember = await this.memberModel.findOne({
      conversationId: conversation._id,
      userId: dto.targetUserId,
    });

    if (!targetMember) {
      throw new NotFoundException(
        'Thành viên muốn xoá không tồn tại trong nhóm',
      );
    }

    if (
      actorMember.role === MemberRole.ADMIN &&
      targetMember.role !== MemberRole.MEMBER
    ) {
      throw new ForbiddenException(
        'Nhóm phó chỉ được phép xoá thành viên thường',
      );
    }

    await this.memberModel.deleteOne({ _id: targetMember._id });

    return {
      success: true,
      message: 'Đã xoá thành viên khỏi nhóm',
      data: {
        removeUserId: dto.targetUserId,
      },
    };
  }

  async addMember(conversationId: string, actorId: string, dto: AddMemberDto) {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Nhóm trò chuyện không tồn tại');
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new BadRequestException('Chỉ áp dụng cho nhóm chat');
    }

    const actorMember = await this.memberModel.findOne({
      conversationId: conversation._id,
      userId: actorId,
    });

    if (!actorMember) {
      throw new ForbiddenException('Bạn không phải là thành viên của nhóm này');
    }

    const isManager = [MemberRole.OWNER, MemberRole.ADMIN].includes(
      actorMember.role,
    );

    if (!isManager && !conversation.group?.allowMembersInvite) {
      throw new ForbiddenException(
        'Chỉ cho phép trưởng nhóm và phó nhóm thêm thành viên',
      );
    }

    const existingMembers = await this.memberModel.find({
      conversationId: conversation._id,
      userId: { $in: dto.userIds },
    });

    const existingUserIds = existingMembers.map((m) => m.userId.toString());

    const newUserIds = dto.userIds.filter(
      (uid) => !existingUserIds.includes(uid),
    );

    if (newUserIds.length === 0) {
      throw new BadRequestException(
        'Tất cả thành viên này đều đã có trong nhóm',
      );
    }

    const newMembersData = newUserIds.map((uid) => ({
      conversationId: conversation._id,
      userId: uid,
      role: MemberRole.MEMBER,
      joinedAt: new Date(),
    }));

    await this.memberModel.insertMany(newMembersData);

    return {
      success: true,
      message: `Đã thêm ${newMembersData.length} thành viên vào nhóm`,
      data: {
        addedUserIds: newUserIds,
        ignoredUserIds: existingUserIds,
      },
    };
  }
}
