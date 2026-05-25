import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Conversation, JoinRequest } from './schemas/conversation.schema';
import { Connection, Model, Types } from 'mongoose';
import { Member } from '../members/schemas/member.schema';
import { CreateGroupDto } from './dto/create-group.dto';
import { Message } from '../messages/schemas/message.schema';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { TransferOwnerDto } from './dto/transfer-owner.dto';
import { RemoveMemberDto } from './dto/remove-member.dto';
import { AddMemberDto } from './dto/add-member.dto';

import e from 'express';
import { User } from '../users/schemas/user.schema';

import { ConversationItemDto } from './dto/conversation-item.dto';
import { StorageService } from 'src/common/storage/storage.service';
import { ConversationType } from 'src/common/types/enums/conversation-type';
import { MemberRole } from 'src/common/types/enums/member-role';
import { ChatGateway } from '../chat/chat.gateway';
import { CallStatus } from 'src/common/types/enums/call-status';
import { MessagesService } from '../messages/messages.service';
import { UpdateGroupDto } from './dto/udate-group.dto';
import { SearchConversationsDto } from './dto/search-conversations.dto';
import { FriendStatus } from 'src/common/types/enums/friend-status';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name)
    private conversationModel: Model<Conversation>,
    @InjectModel(Member.name) private memberModel: Model<Member>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
    @InjectModel('User') private userModel: Model<User>,

    @InjectConnection() private connection: Connection,
    private readonly storageService: StorageService,

    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
    @Inject(forwardRef(() => MessagesService))
    private readonly messagesService: MessagesService,
    @InjectModel(JoinRequest.name)
    private readonly joinRequestModel: Model<JoinRequest>,
  ) { }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async getFormattedConversationForUser(
    conversationId: string,
    userId: string,
  ) {
    const list = await this.getConversationsFromUser(userId);
    return list.find(
      (c) => c.conversationId.toString() === conversationId.toString(),
    );
  }

  async createGroup(creatorId: string, dto: CreateGroupDto) {
    const uniqueMemberIds = [...new Set(dto.memberIds)];
    let groupName = dto.name?.trim();
    if (!groupName) {
      const idsToFetch = [creatorId, ...uniqueMemberIds.slice(0, 2)];
      const usersForName = await this.userModel
        .find({ _id: { $in: idsToFetch } })
        .select('profile.name')
        .lean();

      const sortedUsers = idsToFetch
        .map((id) =>
          usersForName.find((u) => u._id.toString() === id.toString()),
        )
        .filter((u) => u && u.profile?.name);

      groupName = sortedUsers.map((u) => u?.profile?.name).join(', ');
      if (uniqueMemberIds.length > 2) {
        groupName += ` và ${uniqueMemberIds.length - 2} người khác`;
      }
    }
    if (uniqueMemberIds.includes(creatorId)) {
      throw new BadRequestException(
        'Danh sách thành viên không được chứa người tạo',
      );
    }

    const avatarUrl =
      dto.avatarUrl || 'https://your-cdn.com/default-group-avatar.png';

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // 1. Tạo Conversation
      const newConversation = new this.conversationModel({
        type: ConversationType.GROUP,
        group: {
          name: groupName,
          avatarUrl: avatarUrl,
          allowMembersInvite: true,
          allowMembersSendMessages: true,
          ownerId: new Types.ObjectId(creatorId), // BUG-3 fix: keep ownerId in sync
        },
        lastMessageAt: new Date(),
      });
      const savedConversation = await newConversation.save({ session });
      const conversationId = savedConversation._id;

      // 2. Tạo tất cả thành viên (Dùng insertMany để tối ưu)
      const allMembersData = [
        { userId: new Types.ObjectId(creatorId), role: MemberRole.OWNER },
        ...uniqueMemberIds.map((id) => ({
          userId: new Types.ObjectId(id),
          role: MemberRole.MEMBER,
        })),
      ].map((m) => ({
        ...m,
        conversationId,
        joinedAt: new Date(),
      }));

      await this.memberModel.insertMany(allMembersData, { session });

      // 3. Tạo tin nhắn hệ thống
      const creatorName = await this.getUserName(creatorId);
      const systemMsg = await this.createSystemMessage(
        conversationId.toString(),
        `${creatorName} đã tạo nhóm ${groupName}`,
        session,
      );

      await session.commitTransaction();

      const fullConversation = await this.conversationModel
        .findById(conversationId)
        .lean();

      const socketData = {
        conversationId: conversationId.toString(),
        name: fullConversation?.group?.name,
        avatar: fullConversation?.group?.avatarUrl,
        type: fullConversation?.type,
        lastMessage: {
          _id: systemMsg._id,
          content: systemMsg.content,
          type: systemMsg.type,
          senderName: '',
          createdAt: systemMsg.createdAt,
        },
        lastMessageAt: fullConversation?.lastMessageAt,
        unreadCount: 0,
        pinned: false,
      };

      const allMemberIdsStrings = [creatorId, ...uniqueMemberIds];

      allMemberIdsStrings.forEach((memberId) => {
        this.chatGateway.server
          .to(memberId.toString())
          .emit('new_conversation', socketData);
      });

      return {
        success: true,
        message: 'Tạo nhóm thành công',
        data: {
          conversation: fullConversation,
          totalMembers: allMembersData.length,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      console.error('Create Group Error:', error);
      throw new InternalServerErrorException('Lỗi khi tạo nhóm.');
    } finally {
      await session.endSession();
    }
  }

  async deleteGroup(conversationId: string, userId: string) {
    const convObjectId = new Types.ObjectId(conversationId.trim());
    const userObjectId = new Types.ObjectId(userId.trim());

    const conversation = await this.conversationModel.findById(convObjectId);
    if (!conversation) {
      throw new NotFoundException('Nhóm trò chuyện không tồn tại');
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new BadRequestException('Chỉ áp dụng cho nhóm chat');
    }

    const owner = await this.memberModel.findOne({
      conversationId: convObjectId,
      userId: userObjectId,
      leftAt: null,
    });

    if (!owner || owner.role !== MemberRole.OWNER) {
      throw new ForbiddenException(
        'Chỉ trưởng nhóm mới có quyền giải tán nhóm',
      );
    }

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const now = new Date();

      await this.memberModel.updateMany(
        { conversationId: convObjectId, leftAt: null },
        { $set: { leftAt: now } },
        { session },
      );

      await this.createSystemMessage(
        conversationId,
        'Trưởng nhóm đã giải tán nhóm này',
        session,
      );

      await session.commitTransaction();

      const convIdStr = convObjectId.toString();

      this.chatGateway.server.to(convIdStr).emit('group_disbanded', {
        conversationId: convIdStr,
      });

      return {
        success: true,
        message: 'Giải tán nhóm thành công (xóa mềm)',
      };
    } catch (error) {
      await session.abortTransaction();
      console.error('Lỗi giải tán nhóm:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async updateMembersRole(
    conversationId: string,
    actorId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const convObjectId = new Types.ObjectId(conversationId.trim());
    const actorObjectId = new Types.ObjectId(actorId.trim());

    const targetIds = dto.memberIds
      .filter((id) => id !== actorId)
      .map((id) => new Types.ObjectId(id.trim()));

    const conversation = await this.conversationModel.findById(convObjectId);
    if (!conversation) {
      throw new NotFoundException('Nhóm trò chuyện không tồn tại');
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new BadRequestException('Chỉ áp dụng cho nhóm chat');
    }

    const owner = await this.memberModel.findOne({
      conversationId: convObjectId,
      userId: actorObjectId,
      leftAt: null,
    });

    if (!owner || owner.role !== MemberRole.OWNER) {
      throw new ForbiddenException('Chỉ trưởng nhóm mới có quyền phân quyền');
    }

    if (targetIds.length === 0) {
      throw new BadRequestException(
        'Vui lòng chọn thành viên hợp lệ để phân quyền',
      );
    }

    if (dto.newRole === MemberRole.OWNER) {
      throw new BadRequestException(
        'Vui lòng sử dụng tính năng chuyển nhượng trưởng nhóm riêng',
      );
    }

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const result = await this.memberModel.updateMany(
        {
          conversationId: convObjectId,
          userId: { $in: targetIds },
        },
        { $set: { role: dto.newRole } },
        { session },
      );

      if (result.matchedCount === 0) {
        throw new NotFoundException(
          'Không tìm thấy thành viên nào để cập nhật',
        );
      }

      const actorName = await this.getUserName(actorId);
      const roleName =
        dto.newRole === MemberRole.ADMIN ? 'Phó nhóm' : 'Thành viên';

      const systemMsg = await this.createSystemMessage(
        conversationId,
        `${actorName} đã chỉ định ${result.modifiedCount} người làm ${roleName}`,
        session,
      );

      await session.commitTransaction();

      const convIdStr = convObjectId.toString();

      this.chatGateway.server.to(convIdStr).emit('new_message', {
        ...systemMsg.toObject(),
        conversationId: convIdStr,
      });

      this.chatGateway.server.to(convIdStr).emit('new_message_sidebar', {
        conversationId: convIdStr,
        lastMessage: {
          content: systemMsg.content,
          senderName: null,
          type: 'SYSTEM',
          createdAt: systemMsg.createdAt,
        },
      });

      this.chatGateway.server.to(convIdStr).emit('conversation_updated', {
        conversationId: convIdStr,
        type: 'ROLE_UPDATE',
        data: {
          memberIds: dto.memberIds,
          newRole: dto.newRole,
        },
      });
      this.chatGateway.server.to(convIdStr).emit('role_updated', {
        conversationId: convIdStr,
        memberIds: dto.memberIds,
        newRole: dto.newRole,
      });

      return {
        success: true,
        message: `Đã cập nhật quyền cho ${result.modifiedCount} thành viên`,
      };
    } catch (error) {
      await session.abortTransaction();
      console.error('Lỗi phân quyền:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async transferOwner(
    conversationId: string,
    currentOwnerId: string,
    dto: TransferOwnerDto,
  ) {
    const convObjectId = new Types.ObjectId(conversationId.trim());
    const currentOwnerObjectId = new Types.ObjectId(currentOwnerId.trim());
    const targetObjectId = new Types.ObjectId(dto.targetUserId.trim());

    if (currentOwnerId === dto.targetUserId) {
      throw new BadRequestException('Bạn đã là trưởng nhóm rồi');
    }

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const conversation = await this.conversationModel.findById(convObjectId);
      if (!conversation) {
        throw new NotFoundException('Nhóm trò chuyện không tồn tại');
      }

      if (conversation.type !== ConversationType.GROUP) {
        throw new BadRequestException('Chỉ áp dụng cho nhóm chat');
      }

      const currentOwnerMember = await this.memberModel.findOne({
        conversationId: convObjectId,
        userId: currentOwnerObjectId,
        leftAt: null,
      });

      if (!currentOwnerMember || currentOwnerMember.role !== MemberRole.OWNER) {
        throw new ForbiddenException(
          'Chỉ trưởng nhóm mới có quyền chuyển nhượng',
        );
      }

      const targetMember = await this.memberModel.findOne({
        conversationId: convObjectId,
        userId: targetObjectId,
        leftAt: null,
      });

      if (!targetMember) {
        throw new NotFoundException(
          'Thành viên nhận quyền không tồn tại hoặc đã rời nhóm',
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

      // BUG-3 fix: sync group.ownerId to stay consistent with Member.role
      await this.conversationModel
        .updateOne(
          { _id: convObjectId },
          { $set: { 'group.ownerId': targetObjectId } },
        )
        .session(session);

      const oldOwnerName = await this.getUserName(currentOwnerId);
      const newOwnerName = await this.getUserName(dto.targetUserId);

      const systemMsg = await this.createSystemMessage(
        conversationId,
        `${oldOwnerName} đã chuyển quyền Trưởng nhóm cho ${newOwnerName}`,
        session,
      );

      await session.commitTransaction();

      const convIdStr = convObjectId.toString();

      this.chatGateway.server.to(convIdStr).emit('new_message', {
        ...systemMsg.toObject(),
        conversationId: convIdStr,
      });

      const roleUpdatePayload = {
        conversationId: convIdStr,
        memberIds: [currentOwnerId, dto.targetUserId],
        newRoles: {
          [currentOwnerId]: MemberRole.MEMBER,
          [dto.targetUserId]: MemberRole.OWNER,
        },
      };

      this.chatGateway.server
        .to(convIdStr)
        .emit('role_updated', roleUpdatePayload);

      this.chatGateway.server.to(convIdStr).emit('conversation_updated', {
        conversationId: convIdStr,
        type: 'ROLE_UPDATE',
        data: roleUpdatePayload,
      });

      return {
        success: true,
        message: 'Chuyển nhượng trưởng nhóm thành công',
      };
    } catch (error) {
      await session.abortTransaction();
      console.error('Lỗi chuyển nhượng:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async removeMember(
    conversationId: string,
    actorId: string,
    targetUserId: string,
  ) {
    const convObjectId = new Types.ObjectId(conversationId.trim());
    const actorObjectId = new Types.ObjectId(actorId.trim());
    const targetObjectId = new Types.ObjectId(targetUserId.trim());

    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      const actorMember = await this.memberModel
        .findOne({
          conversationId: convObjectId,
          userId: actorObjectId,
          leftAt: null,
        })
        .session(session);

      if (!actorMember || actorMember.role === MemberRole.MEMBER) {
        throw new ForbiddenException('Bạn không có quyền xóa thành viên');
      }

      const targetMember = await this.memberModel
        .findOne({
          conversationId: convObjectId,
          userId: targetObjectId,
          leftAt: null,
        })
        .session(session);

      if (!targetMember)
        throw new NotFoundException('Thành viên không tồn tại trong nhóm');

      // Logic: Phó nhóm không được xóa Trưởng nhóm hoặc Phó nhóm khác
      if (
        actorMember.role === MemberRole.ADMIN &&
        targetMember.role !== MemberRole.MEMBER
      ) {
        throw new ForbiddenException(
          'Phó nhóm chỉ có thể xóa thành viên thường',
        );
      }

      await this.memberModel
        .updateOne({ _id: targetMember._id }, { $set: { leftAt: new Date() } })
        .session(session);

      const actorName = await this.getUserName(actorId);
      const targetName = await this.getUserName(targetUserId);
      const systemMsg = await this.createSystemMessage(
        conversationId,
        `${actorName} đã mời ${targetName} rời khỏi nhóm`,
        session,
      );

      await session.commitTransaction();

      const convIdStr = conversationId.toString();

      // 1. Thông báo tin nhắn hệ thống cho cả nhóm
      this.chatGateway.server.to(convIdStr).emit('new_message', {
        ...systemMsg.toObject(),
        conversationId: convIdStr,
      });

      // 2. Thông báo riêng cho người bị xóa để họ xóa UI
      this.chatGateway.server
        .to(targetUserId)
        .emit('removed_from_conversation', {
          conversationId: convIdStr,
        });

      // 3. Thông báo cho mọi người trong nhóm update list thành viên
      this.chatGateway.server.to(convIdStr).emit('member_removed', {
        conversationId: convIdStr,
        removedUserId: targetUserId,
      });

      // 4. QUAN TRỌNG: Đuổi socket ra khỏi room
      this.chatGateway.handleKickUserFromRoom(targetUserId, convIdStr);

      return {
        success: true,
        message: 'Đã xóa thành viên khỏi nhóm (xóa mềm)',
        data: { removeUserId: targetUserId },
      };
    } catch (error) {
      await session.abortTransaction();
      throw new InternalServerErrorException('Lỗi khi xóa thành viên');
    } finally {
      await session.endSession();
    }
  }

  async addMember(conversationId: string, actorId: string, dto: AddMemberDto) {
    const convObjectId = new Types.ObjectId(conversationId.trim());
    const actorObjectId = new Types.ObjectId(actorId.trim());
    const uniqueUserIds = [...new Set(dto.userIds.map((id) => id.trim()))];

    if (uniqueUserIds.length > 100) {
      throw new BadRequestException(
        'Mỗi lần chỉ có thể thêm tối đa 100 thành viên',
      );
    }

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // 1. Kiểm tra sự tồn tại của Nhóm và Quyền của người mời
      const conversation = await this.conversationModel
        .findById(convObjectId)
        .session(session);
      if (!conversation) throw new NotFoundException('Nhóm không tồn tại');

      const actorMember = await this.memberModel
        .findOne({
          conversationId: convObjectId,
          userId: actorObjectId,
          leftAt: null,
        })
        .session(session);

      if (!actorMember)
        throw new ForbiddenException('Bạn không thuộc nhóm này');

      // 2. Kiểm tra 3 chế độ mời
      const isManager = [MemberRole.OWNER, MemberRole.ADMIN].includes(
        actorMember.role as MemberRole,
      );
      const allowInvite = conversation.group?.allowMembersInvite !== false;
      const approvalRequired = conversation.group?.approvalRequired === true;

      // Chế độ 1: Chỉ quản lý mới được mời
      if (!isManager && !allowInvite) {
        throw new ForbiddenException(
          'Trưởng/Phó nhóm đã tắt tính năng thêm thành viên cho người thường',
        );
      }

      // 3. Lọc danh sách người dùng thực sự cần xử lý (loại bỏ người đang ở trong nhóm)
      const existingMembers = await this.memberModel
        .find({
          conversationId: convObjectId,
          userId: { $in: uniqueUserIds.map((id) => new Types.ObjectId(id)) },
          leftAt: null,
        })
        .session(session);

      const alreadyInGroupIds = existingMembers.map((m) => m.userId.toString());
      const finalIdsToProcess = uniqueUserIds.filter(
        (uid) => !alreadyInGroupIds.includes(uid),
      );

      if (finalIdsToProcess.length === 0) {
        throw new BadRequestException('Tất cả người này đã là thành viên nhóm');
      }

      // --- XỬ LÝ CHẾ ĐỘ 3: PHÊ DUYỆT THÀNH VIÊN ---
      if (approvalRequired && !isManager) {
        // 1. TÌM NHỮNG YÊU CẦU ĐÃ TỒN TẠI VÀ ĐANG CHỜ DUYỆT
        const existingRequests = await this.joinRequestModel
          .find({
            conversationId: convObjectId,
            userId: {
              $in: finalIdsToProcess.map((id) => new Types.ObjectId(id)),
            },
            status: 'PENDING',
          })
          .session(session);

        // 2. LẤY RA DANH SÁCH ID ĐÃ ĐƯỢC GỬI YÊU CẦU
        const alreadyRequestedIds = existingRequests.map((req) =>
          req.userId.toString(),
        );

        // 3. LỌC RA NHỮNG NGƯỜI CHƯA TỪNG ĐƯỢC GỬI YÊU CẦU
        const trulyNewIdsToProcess = finalIdsToProcess.filter(
          (uid) => !alreadyRequestedIds.includes(uid),
        );

        // 4. CHẶN SPAM: Nếu tất cả đều đã được gửi lời mời rồi
        if (trulyNewIdsToProcess.length === 0) {
          throw new BadRequestException(
            'Lời mời tham gia nhóm đã được gửi trước đó và đang chờ quản trị viên duyệt.',
          );
        }

        // 5. CHỈ TẠO REQUEST MỚI CHO NHỮNG NGƯỜI CHƯA CÓ TRONG HÀNG CHỜ
        const joinRequests = trulyNewIdsToProcess.map((uid) => ({
          conversationId: convObjectId,
          userId: new Types.ObjectId(uid),
          invitedBy: actorObjectId,
          status: 'PENDING',
        }));

        await this.joinRequestModel.insertMany(joinRequests, { session });

        await session.commitTransaction();

        // Socket thông báo (Chỉ đếm số lượng người THỰC SỰ mới được tạo request)
        this.chatGateway.server
          .to(convObjectId.toString())
          .emit('new_approval_request', {
            conversationId: convObjectId.toString(),
            count: trulyNewIdsToProcess.length,
          });

        return {
          success: true,
          message: 'Yêu cầu tham gia đã được gửi tới quản trị viên',
          isPending: true,
        };
      }

      // --- XỬ LÝ CHẾ ĐỘ 1 & 2: THÊM TRỰC TIẾP ---

      // Tìm những người từng ở trong nhóm nhưng đã rời (để update leftAt = null)
      const oldMemberRecords = await this.memberModel
        .find({
          conversationId: convObjectId,
          userId: {
            $in: finalIdsToProcess.map((id) => new Types.ObjectId(id)),
          },
          leftAt: { $ne: null },
        })
        .session(session);

      const oldUserIds = oldMemberRecords.map((m) => m.userId.toString());
      const brandNewUserIds = finalIdsToProcess.filter(
        (uid) => !oldUserIds.includes(uid),
      );

      // Update người cũ quay lại
      if (oldUserIds.length > 0) {
        await this.memberModel.updateMany(
          {
            conversationId: convObjectId,
            userId: { $in: oldUserIds.map((id) => new Types.ObjectId(id)) },
          },
          {
            $set: {
              leftAt: null,
              joinedAt: new Date(),
              role: MemberRole.MEMBER,
              unreadCount: 0,
            },
          },
          { session },
        );
      }

      // Insert người mới tinh
      if (brandNewUserIds.length > 0) {
        const newMembersData = brandNewUserIds.map((uid) => ({
          conversationId: convObjectId,
          userId: new Types.ObjectId(uid),
          role: MemberRole.MEMBER,
          joinedAt: new Date(),
        }));
        await this.memberModel.insertMany(newMembersData, { session });
      }
      const allAddedIds = [
        ...brandNewUserIds.map((uid) => new Types.ObjectId(uid)),
        ...oldUserIds.map((uid) => new Types.ObjectId(uid)),
      ];

      if (allAddedIds.length > 0) {
        // Cập nhật mảng participants để đồng bộ danh sách chat
        await this.conversationModel.findByIdAndUpdate(
          convObjectId,
          { $addToSet: { participants: { $each: allAddedIds } } },
          { session },
        );
      }
      // 4. Tạo tin nhắn hệ thống
      const actorName = await this.getUserName(actorId);
      const sampleUsers = await this.userModel
        .find({
          _id: {
            $in: finalIdsToProcess
              .slice(0, 3)
              .map((id) => new Types.ObjectId(id)),
          },
        })
        .select('profile.name')
        .session(session)
        .lean();

      const names = sampleUsers.map((u) => u.profile?.name).join(', ');
      const suffix =
        finalIdsToProcess.length > 3
          ? ` và ${finalIdsToProcess.length - 3} người khác`
          : '';

      const systemMsg = await this.createSystemMessage(
        conversationId,
        `${actorName} đã thêm ${names}${suffix} vào nhóm`,
        session,
      );

      await session.commitTransaction();

      // 5. Socket thông báo Real-time
      const convIdStr = convObjectId.toString();

      // Thông báo cho mọi người hiện tại (Tin nhắn hệ thống)
      this.chatGateway.server.to(convIdStr).emit('new_message', {
        ...systemMsg.toObject(),
        conversationId: convIdStr,
      });

      // Thông báo cho từng người mới (Hội thoại mới hiện lên sidebar)
      // PERF-1 fix: batch parallel emit thay vì sequential loop gây N+1 aggregation
      const BATCH_SIZE = 10;
      for (let i = 0; i < finalIdsToProcess.length; i += BATCH_SIZE) {
        const batch = finalIdsToProcess.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (uid) => {
            const formattedConv = await this.getFormattedConversationForUser(
              convIdStr,
              uid,
            );
            this.chatGateway.server
              .to(uid)
              .emit('new_conversation', formattedConv);
            this.chatGateway.handleUserJoinRoom(uid, convIdStr);
          }),
        );
      }
      this.chatGateway.server.to(convIdStr).emit('member_updated', {
        conversationId: convIdStr,
        type: 'ADD',
      });

      return {
        success: true,
        message: `Đã thêm ${finalIdsToProcess.length} thành viên`,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  private async getUserName(userId: string): Promise<string> {
    const user = await this.userModel
      .findById(userId)
      .select('profile.name')
      .lean();
    return user?.profile?.name || 'Người dùng Zalo';
  }

  private async createSystemMessage(
    conversationId: string,
    content: string,
    session?: any,
  ) {
    const systemMessage = new this.messageModel({
      conversationId: new Types.ObjectId(conversationId),
      senderId: null,
      type: 'SYSTEM',
      content: {
        text: content,
      },
    });

    const savedMessage = await systemMessage.save({ session });

    await this.conversationModel.findByIdAndUpdate(
      conversationId,
      {
        lastMessageId: savedMessage._id,
        lastMessageAt: savedMessage.createdAt,
      },
      {
        session,
      },
    );

    return savedMessage;
  }

  async getConversationsFromUser(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const currentUser = await this.userModel
      .findById(userObjectId)
      .select({ friends: 1 })
      .lean();
    const acceptedFriendIds = new Set(
      (currentUser?.friends ?? [])
        .filter((friend) => friend.status === FriendStatus.ACCEPTED)
        .map((friend) => friend.friendId.toString()),
    );
    const conversations = await this.memberModel.aggregate([
      { $match: { userId: userObjectId, leftAt: null } },
      {
        $lookup: {
          from: 'conversations',
          localField: 'conversationId',
          foreignField: '_id',
          as: 'conversation',
        },
      },
      { $unwind: '$conversation' },

      // Lấy last message
      {
        $lookup: {
          from: 'messages',
          let: {
            convId: '$conversationId',
            lastMsgId: '$conversation.lastMessageId',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$conversationId', '$$convId'] },
                    {
                      $not: {
                        $in: [userObjectId, { $ifNull: ['$deletedFor', []] }],
                      },
                    },
                    {
                      $or: [
                        {
                          $and: [
                            { $ne: ['$type', 'AI_SUMMARY'] },
                            { $ne: ['$type', 'PRIVATE'] }
                          ]
                        },
                        { $eq: ['$targetUserId', userObjectId] },
                      ],
                    },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: 'lastMessage',
        },
      },
      { $unwind: { path: '$lastMessage', preserveNullAndEmptyArrays: true } },

      // Lấy thông tin người gửi tin nhắn cuối
      {
        $lookup: {
          from: 'users',
          localField: 'lastMessage.senderId',
          foreignField: '_id',
          as: 'lastMessageSender',
        },
      },
      {
        $unwind: {
          path: '$lastMessageSender',
          preserveNullAndEmptyArrays: true,
        },
      },

      // Lấy thông tin thành viên khác
      {
        $lookup: {
          from: 'members',
          let: { convId: '$conversationId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$conversationId', '$$convId'] },
                    { $ne: ['$userId', userObjectId] },
                  ],
                },
              },
            },
            { $limit: 1 },
            {
              $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'userInfo',
              },
            },
            { $unwind: '$userInfo' },
          ],
          as: 'otherMemberInfo',
        },
      },
      {
        $unwind: { path: '$otherMemberInfo', preserveNullAndEmptyArrays: true },
      },

      // Lấy settings
      {
        $lookup: {
          from: 'conversationsettings',
          let: { cid: '$conversation._id', uid: userObjectId },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$conversationId', '$$cid'] },
                    { $eq: ['$userId', '$$uid'] },
                  ],
                },
              },
            },
          ],
          as: 'settings',
        },
      },
      { $unwind: { path: '$settings', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'messages',
          let: {
            conversationId: '$conversation._id',
            currentUser: userObjectId,
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$conversationId', '$$conversationId'] },
                    { $eq: ['$senderId', '$$currentUser'] },
                    {
                      $not: {
                        $in: [
                          '$$currentUser',
                          { $ifNull: ['$deletedFor', []] },
                        ],
                      },
                    },
                    { $ne: ['$recalled', true] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: 'sentByCurrentUser',
        },
      },

      // Tính unreadCount
      {
        $lookup: {
          from: 'messages',
          let: {
            conversationId: '$conversation._id',
            lastReadMessageId: '$lastReadMessageId',
            currentUser: userObjectId,
            clearAt: '$settings.clearAt',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$conversationId', '$$conversationId'] },
                    // Tin nhắn sau lastReadMessageId
                    {
                      $gt: [
                        '$_id',
                        {
                          $ifNull: [
                            '$$lastReadMessageId',
                            new Types.ObjectId('000000000000000000000000'),
                          ],
                        },
                      ],
                    },
                    // Không phải tin nhắn của chính user
                    { $ne: ['$senderId', '$$currentUser'] },
                    // Chưa bị xóa cho user
                    {
                      $not: {
                        $in: [
                          '$$currentUser',
                          { $ifNull: ['$deletedFor', []] },
                        ],
                      },
                    },
                    // Chưa bị thu hồi
                    { $ne: ['$recalled', true] },
                    // Chưa hết hạn
                    { $ne: ['$expired', true] },
                    // Sau thời điểm clear (nếu có)
                    {
                      $or: [
                        { $eq: ['$$clearAt', null] },
                        { $gt: ['$createdAt', '$$clearAt'] },
                      ],
                    },
                    // Không tính tin nhắn AI/PRIVATE của người khác
                    {
                      $or: [
                        {
                          $and: [
                            { $ne: ['$type', 'AI_SUMMARY'] },
                            { $ne: ['$type', 'PRIVATE'] }
                          ]
                        },
                        { $eq: ['$targetUserId', '$$currentUser'] },
                      ],
                    },
                    // Chưa expiresAt
                    {
                      $or: [
                        { $eq: ['$expiresAt', null] },
                        { $gt: ['$expiresAt', '$$NOW'] },
                      ],
                    },
                  ],
                },
              },
            },
            {
              $count: 'count',
            },
          ],
          as: 'unreadData',
        },
      },

      // Filter conversation đã bị xóa
      {
        $match: {
          $or: [
            { settings: null },
            { 'settings.deletedAt': null },
            {
              $expr: {
                $gt: ['$conversation.lastMessageAt', '$settings.deletedAt'],
              },
            },
          ],
        },
      },

      {
        $project: {
          _id: 0,
          conversationId: '$conversation._id',
          type: '$conversation.type',
          group: '$conversation.group',
          myRole: '$role',
          unreadCount: {
            $ifNull: [{ $arrayElemAt: ['$unreadData.count', 0] }, 0],
          },
          pinned: { $ifNull: ['$settings.pinned', false] },
          hidden: { $ifNull: ['$settings.hidden', false] },
          category: { $ifNull: ['$settings.category', null] },
          expireDuration: { $ifNull: ['$settings.expireDuration', 0] },
          muted: {
            $cond: [
              {
                $and: [
                  { $ne: ['$settings.mutedUntil', null] },
                  { $gt: ['$settings.mutedUntil', '$$NOW'] },
                ],
              },
              true,
              false,
            ],
          },
          name: {
            $cond: [
              { $eq: ['$conversation.type', ConversationType.GROUP] },
              '$conversation.group.name',
              {
                $ifNull: [
                  '$otherMemberInfo.userInfo.profile.name',
                  'Người dùng Zalo',
                ],
              },
            ],
          },
          avatar: {
            $cond: [
              { $eq: ['$conversation.type', ConversationType.GROUP] },
              '$conversation.group.avatarUrl',
              '$otherMemberInfo.userInfo.profile.avatarUrl',
            ],
          },
          otherMemberId: '$otherMemberInfo.userId',
          hasSentMessage: {
            $gt: [{ $size: { $ifNull: ['$sentByCurrentUser', []] } }, 0],
          },
          lastMessage: {
            _id: '$lastMessage._id',
            senderName: {
              $cond: [
                { $eq: ['$lastMessage.senderId', userObjectId] },
                'Bạn',
                { $ifNull: ['$lastMessageSender.profile.name', ''] },
              ],
            },
            content: '$lastMessage.content',
            recalled: { $ifNull: ['$lastMessage.recalled', false] },
            type: '$lastMessage.type',
            call: '$lastMessage.call',
            expired: '$lastMessage.expired',
            expiresAt: '$lastMessage.expiresAt',
          },
          lastMessageAt: '$conversation.lastMessageAt',
        },
      },
      { $sort: { unreadCount: -1, lastMessageAt: -1 } },
      { $group: { _id: '$conversationId', data: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$data' } },
    ]);

    return conversations.map((c) => ({
      ...c,
      otherMemberId: c?.otherMemberId?.toString?.() ?? c?.otherMemberId ?? null,
      isStranger:
        c?.type === ConversationType.DIRECT &&
        !!(c?.otherMemberId?.toString?.() ?? c?.otherMemberId) &&
        !acceptedFriendIds.has(
          c?.otherMemberId?.toString?.() ?? c?.otherMemberId ?? '',
        ) &&
        !c?.hasSentMessage,
      avatar: c.avatar ? this.storageService.signFileUrl(c.avatar) : null,
    }));
  }

  async getOrCreateDirectConversation(user1Id: string, user2Id: string) {
    if (user1Id === user2Id)
      throw new BadRequestException('Không thể tạo hội thoại với chính mình');
    const BOT_ID = "69f438929cf8b39d88abd220";
    const u1 = new Types.ObjectId(user1Id);
    const u2 = new Types.ObjectId(user2Id);

    let conversation = await this.conversationModel.findOne({
      type: ConversationType.DIRECT || ConversationType.AI,
      participants: { $all: [u1, u2] },
    });

    if (conversation) return conversation;

    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      const isAi = user1Id === BOT_ID || user2Id === BOT_ID;
      const savedConv = await new this.conversationModel({
        type: isAi ? ConversationType.AI : ConversationType.DIRECT,
        participants: [u1, u2],
        lastMessageAt: new Date(),
      }).save({ session });

      await this.memberModel.insertMany(
        [
          {
            conversationId: savedConv._id,
            userId: u1,
            role: MemberRole.MEMBER,
            joinedAt: new Date(),
            unreadCount: 0,
          },
          {
            conversationId: savedConv._id,
            userId: u2,
            role: MemberRole.MEMBER,
            joinedAt: new Date(),
            unreadCount: 0,
          },
        ],
        { session },
      );
      await session.commitTransaction();

      const formatted = await this.getFormattedConversationForUser(
        savedConv._id.toString(),
        user2Id,
      );
      this.chatGateway.server.to(user2Id).emit('new_conversation', formatted);

      return savedConv;
    } catch (error) {
      await session.abortTransaction();
      throw new InternalServerErrorException(
        'Lỗi khi tạo cuộc hội thoại trực tiếp',
      );
    } finally {
      await session.endSession();
    }
  }

  async markAsRead(conversationId: string, userId: string) {
    return this.memberModel.updateOne(
      {
        conversationId: new Types.ObjectId(conversationId),
        userId: new Types.ObjectId(userId),
      },
      { $set: { unreadCount: 0 } },
    );
  }

  async getConversationMembers(
    conversationId: string,
    requesterUserId: string,
  ) {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Hội thoại không tồn tại');
    }

    if (conversation.type !== ConversationType.GROUP) {
      return [];
    }

    const requesterMember = await this.memberModel.findOne({
      conversationId: new Types.ObjectId(conversationId),
      userId: new Types.ObjectId(requesterUserId),
      leftAt: null,
    });
    if (!requesterMember) {
      throw new ForbiddenException('Bạn không phải thành viên của nhóm');
    }

    const members = await this.memberModel
      .find({
        conversationId: new Types.ObjectId(conversationId),
        leftAt: null,
      })
      .populate('userId', 'profile.name profile.avatarUrl')
      .lean();

    const roleOrder: Record<string, number> = {
      [MemberRole.OWNER]: 0,
      [MemberRole.ADMIN]: 1,
      [MemberRole.MEMBER]: 2,
    };

    const list = members.map((m) => {
      const u = m.userId as unknown as {
        _id: Types.ObjectId;
        profile?: { name?: string; avatarUrl?: string };
      };
      const avatarRaw = u?.profile?.avatarUrl;
      return {
        userId: u._id.toString(),
        name: u?.profile?.name ?? 'Người dùng',
        avatarUrl: avatarRaw
          ? this.storageService.signFileUrl(avatarRaw)
          : null,
        role: m.role as MemberRole,
      };
    });

    list.sort(
      (a, b) =>
        (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9) ||
        a.name.localeCompare(b.name),
    );

    return list;
  }

  async leaveGroup(conversationId: string, userId: string) {
    const convObjectId = new Types.ObjectId(conversationId.trim());
    const userObjectId = new Types.ObjectId(userId.trim());

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const member = await this.memberModel
        .findOne({
          conversationId: convObjectId,
          userId: userObjectId,
          leftAt: null,
        })
        .session(session);

      if (!member) {
        throw new NotFoundException(
          'Bạn không phải là thành viên hoặc đã rời nhóm rồi',
        );
      }

      const activeMembersCount = await this.memberModel
        .countDocuments({
          conversationId: convObjectId,
          leftAt: null,
        })
        .session(session);

      if (member.role === MemberRole.OWNER && activeMembersCount > 1) {
        throw new BadRequestException(
          'Bạn phải chuyển quyền Trưởng nhóm cho người khác trước khi rời nhóm',
        );
      }

      await this.memberModel
        .updateOne({ _id: member._id }, { $set: { leftAt: new Date() } })
        .session(session);

      const userName = await this.getUserName(userId);
      let systemMsgContent = `${userName} đã rời khỏi nhóm`;

      if (activeMembersCount === 1) {
        systemMsgContent = `Người cuối cùng đã rời đi, nhóm không còn hoạt động.`;
      }

      const systemMsg = await this.createSystemMessage(
        conversationId,
        systemMsgContent,
        session,
      );

      await session.commitTransaction();

      const convIdStr = convObjectId.toString();

      this.chatGateway.server
        .to(userId)
        .emit('removed_from_conversation', { conversationId: convIdStr });
      if (activeMembersCount > 1) {
        this.chatGateway.server.to(convIdStr).emit('new_message', {
          ...systemMsg.toObject(),
          conversationId: convIdStr,
        });

        this.chatGateway.server.to(convIdStr).emit('member_removed', {
          conversationId: convIdStr,
          removedUserId: userId,
        });
      }

      return { success: true, message: 'Rời nhóm thành công' };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async updateCallStatus(
    messageId: string,
    status: CallStatus,
    conversationId: string,
  ) {
    const updateFields: any = { 'call.status': status };
    const now = new Date();

    switch (status) {
      case CallStatus.ACCEPTED:
        updateFields['call.startedAt'] = now;
        break;

      case CallStatus.ENDED:
        updateFields['call.endedAt'] = now;
        break;

      case CallStatus.REJECTED:
      case CallStatus.MISSED:
      case CallStatus.BUSY:
        updateFields['call.endedAt'] = now;
        updateFields['call.duration'] = 0;
        break;

      case CallStatus.RINGING:
        break;
    }

    return await this.messageModel.findByIdAndUpdate(
      messageId,
      { $set: updateFields },
      { new: true },
    );
  }

  async updateGroupSettings(conversationId: string, userId: string, dto: any) {
    const convObjectId = new Types.ObjectId(conversationId.trim());
    const userObjectId = new Types.ObjectId(userId.trim());

    // --- Kiểm tra quyền (ngoài transaction để fail-fast) ---
    const conversation = await this.conversationModel.findById(convObjectId);
    if (!conversation) throw new NotFoundException('Không tìm thấy nhóm');

    const member = await this.memberModel.findOne({
      conversationId: convObjectId,
      userId: userObjectId,
      leftAt: null,
    });

    if (
      !member ||
      ![MemberRole.OWNER, MemberRole.ADMIN].includes(member.role as any)
    ) {
      throw new ForbiddenException('Bạn không có quyền');
    }

    if (!conversation.group) {
      throw new BadRequestException('Hội thoại này không có dữ liệu nhóm');
    }

    // Xác định nội dung tin nhắn hệ thống (nếu cần) trước khi vào transaction
    let systemMsgContent: string | null = null;
    if (
      dto.allowMembersSendMessages !== undefined &&
      conversation.group.allowMembersSendMessages !== dto.allowMembersSendMessages
    ) {
      const actorName = await this.getUserName(userId);
      const actionText = dto.allowMembersSendMessages
        ? 'mở quyền gửi tin nhắn cho thành viên'
        : 'tắt quyền gửi tin nhắn của thành viên';
      systemMsgContent = `${actorName} đã ${actionText}`;
    }

    // BUG-1 fix: Bọc trong transaction để tránh orphan system messages
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      if (dto.allowMembersInvite !== undefined) {
        conversation.group!.allowMembersInvite = dto.allowMembersInvite;
      }
      if (dto.approvalRequired !== undefined) {
        conversation.group!.approvalRequired = dto.approvalRequired;
      }
      if (dto.allowMembersSendMessages !== undefined) {
        conversation.group!.allowMembersSendMessages = dto.allowMembersSendMessages;
      }

      conversation.markModified('group');
      const savedConversation = await conversation.save({ session });

      let systemMsgObj: any = null;
      if (systemMsgContent) {
        systemMsgObj = await this.createSystemMessage(
          conversationId,
          systemMsgContent,
          session,
        );
      }

      await session.commitTransaction();

      // Emit sau khi commit để đảm bảo data đã được persist
      this.chatGateway.server.to(conversationId).emit('group_settings_updated', {
        conversationId,
        group: savedConversation.group,
      });

      if (systemMsgObj) {
        this.chatGateway.server
          .to(conversationId)
          .emit('new_message', systemMsgObj);
      }

      return {
        success: true,
        message: 'Cập nhật cài đặt thành công',
        data: savedConversation.group,
      };
    } catch (error) {
      await session.abortTransaction();
      console.error('Lỗi updateGroupSettings:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async getJoinRequests(conversationId: string, userId: string) {
    const convObjectId = new Types.ObjectId(conversationId.trim());
    const userObjectId = new Types.ObjectId(userId.trim());

    const member = await this.memberModel.findOne({
      conversationId: convObjectId,
      userId: userObjectId,
      leftAt: null,
    });

    if (
      !member ||
      ![MemberRole.OWNER, MemberRole.ADMIN].includes(member.role as any)
    ) {
      throw new ForbiddenException('Bạn không có quyền xem danh sách chờ');
    }

    const requests = await this.joinRequestModel
      .find({ conversationId: convObjectId, status: 'PENDING' })
      .populate('userId', 'profile.name profile.avatarUrl')
      .populate('invitedBy', 'profile.name')
      .sort({ createdAt: -1 })
      .lean();

    const formattedRequests = await Promise.all(
      requests.map(async (req: any) => {
        let fullAvatarUrl = req.userId?.profile?.avatarUrl;

        if (fullAvatarUrl && !fullAvatarUrl.startsWith('http')) {
          fullAvatarUrl = await this.storageService.signFileUrl(fullAvatarUrl);
        }

        return {
          ...req,
          userId: {
            ...req.userId,
            profile: {
              ...req.userId.profile,
              avatarUrl: fullAvatarUrl,
            },
          },
        };
      }),
    );

    return { success: true, data: formattedRequests };
  }

  async handleJoinRequest(
    conversationId: string,
    requestId: string,
    actorId: string,
    action: 'APPROVED' | 'REJECTED',
  ) {
    const convObjectId = new Types.ObjectId(conversationId.trim());
    const actorObjectId = new Types.ObjectId(actorId.trim());
    const requestObjectId = new Types.ObjectId(requestId.trim());

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // 1. Kiểm tra quyền của người duyệt
      const actorMember = await this.memberModel
        .findOne({
          conversationId: convObjectId,
          userId: actorObjectId,
          leftAt: null,
        })
        .session(session);

      if (
        !actorMember ||
        ![MemberRole.OWNER, MemberRole.ADMIN].includes(actorMember.role as any)
      ) {
        throw new ForbiddenException(
          'Bạn không có quyền thực hiện thao tác này',
        );
      }

      const request = await this.joinRequestModel
        .findById(requestObjectId)
        .session(session);

      if (!request || request.status !== 'PENDING')
        throw new NotFoundException('Yêu cầu không còn tồn tại');

      if (action === 'REJECTED') {
        await this.joinRequestModel
          .findByIdAndUpdate(requestObjectId, { status: 'REJECTED' })
          .session(session);
        await session.commitTransaction();
        return { success: true, message: 'Đã từ chối yêu cầu' };
      }

      // --- LOGIC PHÊ DUYỆT ---
      const targetUserId = request.userId;

      // Thêm vào bảng Member
      await this.memberModel.findOneAndUpdate(
        { conversationId: convObjectId, userId: targetUserId },

        {
          $set: {
            leftAt: null,
            joinedAt: new Date(),
            role: MemberRole.MEMBER,
            unreadCount: 0,
          },
        },
        { upsert: true, session },
      );

      await this.conversationModel.findByIdAndUpdate(
        convObjectId,
        { $addToSet: { participants: targetUserId } },
        { session },
      );

      request.status = 'APPROVED';
      await request.save({ session });

      // Tin nhắn hệ thống
      const actorName = await this.getUserName(actorId);
      const targetName = await this.getUserName(targetUserId.toString());
      const systemMsg = await this.createSystemMessage(
        conversationId,
        `${actorName} đã duyệt ${targetName} vào nhóm`,
        session,
      );

      await session.commitTransaction();

      // Socket thông báo
      const convIdStr = conversationId.toString();
      const formattedConv = await this.getFormattedConversationForUser(
        convIdStr,
        targetUserId.toString(),
      );

      this.chatGateway.server
        .to(targetUserId.toString())
        .emit('new_conversation', formattedConv);
      this.chatGateway.handleUserJoinRoom(targetUserId.toString(), convIdStr);
      this.chatGateway.server.to(convIdStr).emit('new_message', systemMsg);

      this.chatGateway.server.to(convIdStr).emit('member_updated', {
        conversationId: convIdStr,
      });

      return { success: true, message: 'Đã duyệt thành viên vào nhóm' };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async updateGroupInfo(
    conversationId: string,
    userId: string,
    updateDto: any,
    file?: Express.Multer.File,
  ) {
    const convObjectId = new Types.ObjectId(conversationId.trim());
    const userObjectId = new Types.ObjectId(userId.trim());

    // --- Kiểm tra sự tồn tại và quyền (ngoài transaction để fail-fast) ---
    const conversation = await this.conversationModel.findById(convObjectId);
    if (
      !conversation ||
      conversation.type !== ConversationType.GROUP ||
      !conversation.group
    ) {
      throw new NotFoundException(
        'Không tìm thấy nhóm hoặc hội thoại không phải là nhóm',
      );
    }

    const member = await this.memberModel.findOne({
      conversationId: convObjectId,
      userId: userObjectId,
      leftAt: null,
    });

    if (
      !member ||
      ![MemberRole.OWNER, MemberRole.ADMIN].includes(member.role as any)
    ) {
      throw new ForbiddenException(
        'Bạn không có quyền chỉnh sửa thông tin nhóm',
      );
    }

    const updateData: any = {};
    const notifications: string[] = [];
    const actorName = await this.getUserName(userId);

    if (updateDto.name && updateDto.name !== conversation.group.name) {
      updateData['group.name'] = updateDto.name;
      notifications.push(
        `${actorName} đã đổi tên nhóm thành "${updateDto.name}"`,
      );
    }

    // BUG-2 fix: Upload S3 TRƯỚC transaction (S3 không hỗ trợ rollback).
    // Lưu fileKey mới để có thể cleanup nếu DB fail.
    let newUploadedFileKey: string | null = null;
    const oldAvatarKey = conversation.group.avatarUrl ?? null;

    if (file) {
      const upload = await this.storageService.uploadFile(file);
      newUploadedFileKey = upload.fileKey;
      updateData['group.avatarUrl'] = newUploadedFileKey;
      notifications.push(`${actorName} đã thay đổi ảnh đại diện nhóm`);
    }

    if (Object.keys(updateData).length === 0) return conversation;

    // --- Bọc DB operations trong transaction ---
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const updatedDoc = await this.conversationModel.findByIdAndUpdate(
        convObjectId,
        { $set: updateData },
        { new: true, session },
      );

      if (!updatedDoc) throw new Error('Cập nhật thất bại');

      const savedSystemMsgs: any[] = [];
      for (const text of notifications) {
        const sysMsg = await this.createSystemMessage(conversationId, text, session);
        savedSystemMsgs.push(sysMsg);
      }

      await session.commitTransaction();

      // --- Sau khi commit: xóa avatar cũ (best-effort, không critical) ---
      if (newUploadedFileKey && oldAvatarKey) {
        await this.storageService.deleteFile(oldAvatarKey).catch(() => { });
      }

      // --- Emit socket sau khi commit (dùng savedSystemMsgs, không tạo thêm message) ---
      const result = updatedDoc.toObject();
      if (result.group?.avatarUrl) {
        result.group.avatarUrl =
          this.storageService.signFileUrl(result.group.avatarUrl) ?? undefined;
      }

      for (const sysMsg of savedSystemMsgs) {
        this.chatGateway.server.to(conversationId).emit('new_message', sysMsg);
      }

      this.chatGateway.server.to(conversationId).emit('group_updated', {
        conversationId: conversationId,
        name: result.group?.name,
        avatar: result.group?.avatarUrl,
        group: result.group,
      });

      return {
        success: true,
        message: 'Cập nhật thông tin nhóm thành công',
        data: result,
      };
    } catch (error) {
      await session.abortTransaction();
      // BUG-2 fix: Nếu DB fail, xóa file S3 vừa upload để tránh orphan
      if (newUploadedFileKey) {
        await this.storageService.deleteFile(newUploadedFileKey).catch(() => { });
      }
      console.error('--- LỖI TẠI updateGroupInfo ---', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async search(query: SearchConversationsDto) {
    if (!query.userId || !Types.ObjectId.isValid(query.userId)) {
      throw new BadRequestException('ID người dùng không hợp lệ');
    }

    const userObjectId = new Types.ObjectId(query.userId);
    const keyword = query.keyword.trim();
    const scope = query.scope ?? 'all';
    const limit = Math.min(Math.max(Number(query.limit ?? '8'), 1), 20);
    const regex = new RegExp(this.escapeRegex(keyword), 'i');

    const conversationItems = await this.getConversationsFromUser(query.userId);
    const conversationIds = conversationItems.map(
      (conversation) => conversation.conversationId,
    );
    const conversationMap = new Map(
      conversationItems.map((conversation) => [
        conversation.conversationId.toString(),
        conversation,
      ]),
    );

    const objectConversationIds = conversationIds.map(
      (id) => new Types.ObjectId(id),
    );

    let contacts: any[] = [];
    if (scope === 'all' || scope === 'contacts') {
      // Phát hiện loại tìm kiếm: SĐT (chỉ chứa số và ký tự SĐT) hay tên
      const isPhoneSearch = /^[0-9+\s\-()]{7,15}$/.test(keyword.trim());

      // Lấy danh sách bạn bè ACCEPTED của user hiện tại
      const currentUser = await this.userModel
        .findById(userObjectId)
        .select({ friends: 1 })
        .lean();

      const acceptedFriendIds = new Set(
        (currentUser?.friends ?? [])
          .filter((f) => f.status === FriendStatus.ACCEPTED)
          .map((f) => f.friendId.toString()),
      );

      let matchedUsers: any[] = [];

      if (isPhoneSearch) {
        // Tìm tất cả user theo SĐT (khớp chính xác)
        matchedUsers = await this.userModel
          .find({
            _id: { $ne: userObjectId },
            phone: keyword.trim(),
          })
          .limit(limit)
          .lean();
      } else {
        // Tìm theo tên, chỉ trong danh sách bạn bè ACCEPTED
        const friendObjectIds = Array.from(acceptedFriendIds).map(
          (id) => new Types.ObjectId(id),
        );
        if (friendObjectIds.length > 0) {
          matchedUsers = await this.userModel
            .find({
              _id: { $in: friendObjectIds },
              'profile.name': regex,
            })
            .limit(limit)
            .lean();
        }
      }

      contacts = matchedUsers.map((u) => {
        const isFriend = acceptedFriendIds.has(u._id.toString());
        const existingConv = conversationItems.find(
          (c) =>
            c.type === ConversationType.DIRECT &&
            c.otherMemberId?.toString() === u._id.toString(),
        );

        return {
          conversationId: existingConv?.conversationId || null,
          userId: u._id.toString(),
          name: u.profile?.name || u.phone,
          avatar:
            existingConv?.avatar ||
            (u.profile?.avatarUrl
              ? this.storageService.signFileUrl(u.profile.avatarUrl)
              : null),
          phone: u.phone,
          isFriend,
          isExistingConversation: !!existingConv,
          lastMessageAt: existingConv?.lastMessageAt || null,
        };
      });
    }

    const groups =
      scope === 'all' || scope === 'groups'
        ? conversationItems
          .filter(
            (conversation) =>
              conversation.type === ConversationType.GROUP &&
              regex.test(conversation.name ?? ''),
          )
          .slice(0, limit)
          .map((conversation) => ({
            conversationId: conversation.conversationId,
            name: conversation.name,
            avatar: conversation.avatar,
            lastMessageAt: conversation.lastMessageAt,
            memberLabel: 'Nhom',
          }))
        : [];

    const rawMessages =
      scope === 'all' || scope === 'messages'
        ? await this.messageModel
          .find({
            conversationId: { $in: objectConversationIds },
            deletedFor: { $ne: userObjectId },
            recalled: { $ne: true },
            expired: { $ne: true },
            'content.text': regex,
          })
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate('senderId', 'profile.name profile.avatarUrl')
          .lean<any[]>()
        : [];

    const messages = rawMessages.map((message) => {
      const conversation = conversationMap.get(
        message.conversationId.toString(),
      );
      return {
        messageId: message._id.toString(),
        conversationId: message.conversationId.toString(),
        conversationName: conversation?.name ?? 'Cuoc tro chuyen',
        conversationAvatar: conversation?.avatar ?? null,
        senderName: message.senderId?.profile?.name ?? 'Nguoi dung',
        text: message.content?.text ?? '',
        createdAt: message.createdAt,
      };
    });

    const rawFileMessages =
      scope === 'all' || scope === 'files'
        ? await this.messageModel
          .find({
            conversationId: { $in: objectConversationIds },
            deletedFor: { $ne: userObjectId },
            recalled: { $ne: true },
            expired: { $ne: true },
            'content.files.fileName': regex,
          })
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate('senderId', 'profile.name profile.avatarUrl')
          .lean<any[]>()
        : [];

    const files = rawFileMessages
      .flatMap((message) => {
        const conversation = conversationMap.get(
          message.conversationId.toString(),
        );
        const matchedFiles = (message.content?.files ?? []).filter(
          (file: any) => regex.test(file.fileName ?? ''),
        );

        return matchedFiles.map((file: any) => ({
          messageId: message._id.toString(),
          conversationId: message.conversationId.toString(),
          conversationName: conversation?.name ?? 'Cuoc tro chuyen',
          conversationAvatar: conversation?.avatar ?? null,
          senderName: message.senderId?.profile?.name ?? 'Nguoi dung',
          createdAt: message.createdAt,
          file: {
            fileName: file.fileName,
            fileSize: file.fileSize,
            type: file.type,
            fileKey: this.storageService.signFileUrl(file.fileKey),
          },
        }));
      })
      .slice(0, limit);

    return {
      contacts,
      groups,
      messages,
      files,
    };
  }

  async refreshGroupJoinToken(conversationId: string, userId: string) {
    const convObjectId = new Types.ObjectId(conversationId);
    const userObjectId = new Types.ObjectId(userId);

    // Kiểm tra quyền Admin/Owner
    const member = await this.memberModel.findOne({
      conversationId: convObjectId,
      userId: userObjectId,
      leftAt: null,
    });

    if (!member || ![MemberRole.OWNER, MemberRole.ADMIN].includes(member.role as any)) {
      throw new ForbiddenException('Chỉ Trưởng/Phó nhóm mới có quyền làm mới mã QR');
    }

    // Sinh token ngẫu nhiên (32 ký tự hex)
    const newToken = randomBytes(16).toString('hex');

    const updatedConversation = await this.conversationModel.findByIdAndUpdate(
      convObjectId,
      { $set: { 'group.joinToken': newToken } },
      { new: true }
    );

    if (updatedConversation) {
      this.chatGateway.server.to(conversationId.toString()).emit('group_updated', {
        conversationId: conversationId.toString(),
        group: updatedConversation.group,
      });
    }

    return { success: true, joinToken: newToken };
  }

  async getGroupInfoByToken(conversationId: string, token: string) {
    const convObjectId = new Types.ObjectId(conversationId);

    // 1. Tìm Conversation 
    const conversation = (await this.conversationModel
      .findOne({
        _id: convObjectId,
        type: ConversationType.GROUP,
        'group.joinToken': token,
      })
      .populate({
        path: 'participants',
        select: 'profile.name',
      })
      .lean()) as any;

    if (!conversation) {
      throw new BadRequestException(
        'Mã QR không hợp lệ hoặc đã bị vô hiệu hóa.',
      );
    }

    // 2. Tính số thành viên thực tế
    const activeMembersCount = await this.memberModel.countDocuments({
      conversationId: convObjectId,
      leftAt: null,
    });

    // 3. Xử lý TÊN NHÓM 
    let groupName = conversation.group?.name;

    // Nếu nhóm chưa đặt tên
    if (!groupName || groupName.trim() === '') {
      const participantNames = (conversation.participants || [])
        .filter((p: any) => p && p.profile && p.profile.name)
        .slice(0, 3)
        .map((p: any) => p.profile.name);

      groupName = participantNames.join(', ');
      if (activeMembersCount > 3) {
        groupName += ` và ${activeMembersCount - 3} người khác`;
      }
    }

    const result = {
      success: true,
      data: {
        conversationId: String(conversation._id),
        name: groupName || 'Nhóm chưa đặt tên',
        avatarUrl: conversation.group?.avatarUrl
          ? this.storageService.signFileUrl(conversation.group.avatarUrl)
          : null,
        memberCount: activeMembersCount,
        approvalRequired: conversation.group?.approvalRequired,
      },
    };

    console.log('🚀 [Backend] QR Group Info:', JSON.stringify(result, null, 2));

    return result;
  }

  async joinGroupByToken(conversationId: string, token: string, userId: string) {
    const convObjectId = new Types.ObjectId(conversationId);
    const userObjectId = new Types.ObjectId(userId);
    const convIdStr = conversationId.toString();

    // 1. Xác thực Token
    const conversation = await this.conversationModel.findOne({
      _id: convObjectId,
      type: ConversationType.GROUP,
      'group.joinToken': token,
    });

    if (!conversation) {
      throw new BadRequestException('Mã QR không hợp lệ hoặc đã bị vô hiệu hóa.');
    }

    // 2. Kiểm tra xem đã là thành viên chưa
    const existingMember = await this.memberModel.findOne({
      conversationId: convObjectId,
      userId: userObjectId,
      leftAt: null,
    });
    if (existingMember) throw new BadRequestException('Bạn đã là thành viên của nhóm này rồi.');

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const isApprovalRequired = conversation.group?.approvalRequired === true;

      // --- TRƯỜNG HỢP 1: CẦN PHÊ DUYỆT ---
      if (isApprovalRequired) {
        const existingReq = await this.joinRequestModel.findOne({
          conversationId: convObjectId,
          userId: userObjectId,
          status: 'PENDING',
        }).session(session);

        if (existingReq) {
          throw new BadRequestException('Bạn đã gửi yêu cầu rồi, vui lòng chờ quản trị viên duyệt.');
        }

        await this.joinRequestModel.create([{
          conversationId: convObjectId,
          userId: userObjectId,
          invitedBy: userObjectId,
          status: 'PENDING',
        }], { session });

        // Bắn socket cho Admin biết
        const admins = await this.memberModel.find({
          conversationId: convObjectId,
          role: { $in: [MemberRole.OWNER, MemberRole.ADMIN] },
          leftAt: null
        }).session(session).lean();

        await session.commitTransaction();

        if (this.chatGateway.server) {
          admins.forEach(admin => {
            this.chatGateway.server.to(admin.userId.toString()).emit('new_approval_request', {
              conversationId: convIdStr,
              count: 1,
            });
          });
        }

        return { success: true, message: 'Đã gửi yêu cầu tham gia nhóm', isPending: true };
      }

      // --- TRƯỜNG HỢP 2: VÀO THẲNG NHÓM (KHÔNG CẦN DUYỆT) ---

      // Tìm xem ngày xưa có từng ở trong nhóm không 
      const oldMember = await this.memberModel.findOne({
        conversationId: convObjectId,
        userId: userObjectId,
      }).session(session);

      if (oldMember) {
        oldMember.leftAt = null as any;
        oldMember.joinedAt = new Date();
        oldMember.role = MemberRole.MEMBER;
        oldMember.unreadCount = 1;
        await oldMember.save({ session });
      } else {
        await this.memberModel.create([{
          conversationId: convObjectId,
          userId: userObjectId,
          role: MemberRole.MEMBER,
          joinedAt: new Date(),
          unreadCount: 1,
        }], { session });
      }

      await this.conversationModel.findByIdAndUpdate(
        convObjectId,
        { $addToSet: { participants: userObjectId } },
        { session }
      );

      // Tạo tin nhắn hệ thống
      const userName = await this.getUserName(userId);
      const systemMsg = await this.createSystemMessage(
        conversationId,
        `${userName} đã tham gia nhóm từ link/mã QR`,
        session
      );

      await session.commitTransaction();

      // Đồng bộ Socket cho mọi người và người mới
      if (this.chatGateway.server) {
        const msgData = systemMsg.toJSON ? systemMsg.toJSON() : systemMsg;
        this.chatGateway.server.to(convIdStr).emit('new_message', {
          ...msgData,
          conversationId: convIdStr,
        });

        const formattedConv = await this.getFormattedConversationForUser(convIdStr, userId);
        if (formattedConv) {
          this.chatGateway.server.to(userId).emit('new_conversation', formattedConv);
        }
        this.chatGateway.handleUserJoinRoom(userId, convIdStr);

        this.chatGateway.server.to(convIdStr).emit('member_updated', {
          conversationId: convIdStr,
          type: 'ADD',
        });
      }

      return { success: true, message: 'Đã tham gia nhóm thành công', isPending: false };

    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      console.error('Error in joinGroupByToken:', error);
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(error.message || 'Lỗi hệ thống khi tham gia nhóm');
    } finally {
      session.endSession();
    }
  }

  /**
   * Đếm số nhóm chung giữa 2 user
   */
  async getCommonGroupsCount(
    currentUserId: string,
    targetUserId: string,
  ): Promise<{ count: number }> {
    const currentUserObjId = new Types.ObjectId(currentUserId.trim());
    const targetUserObjId = new Types.ObjectId(targetUserId.trim());

    // 1. Lấy tất cả conversationId mà currentUser đang tham gia (chưa rời)
    const currentUserConvIds = await this.memberModel
      .find({ userId: currentUserObjId, leftAt: null })
      .select('conversationId')
      .lean();

    const convIds = currentUserConvIds.map((m) => m.conversationId);

    if (convIds.length === 0) {
      return { count: 0 };
    }

    // 2. Trong số đó, tìm những conversation mà targetUser cũng đang tham gia
    const commonConvIds = await this.memberModel
      .find({
        userId: targetUserObjId,
        conversationId: { $in: convIds },
        leftAt: null,
      })
      .select('conversationId')
      .lean();

    const commonConvObjectIds = commonConvIds.map((m) => m.conversationId);

    if (commonConvObjectIds.length === 0) {
      return { count: 0 };
    }

    // 3. Chỉ đếm những conversation có type = GROUP
    const count = await this.conversationModel.countDocuments({
      _id: { $in: commonConvObjectIds },
      type: ConversationType.GROUP,
    });

    return { count };
  }
}
