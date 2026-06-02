import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message } from '../schemas/message.schema';
import { Member } from '../../members/schemas/member.schema';
import { Conversation } from '../../conversations/schemas/conversation.schema';
import { MessagesTransformService } from './transform.service';
import { StorageService } from 'src/common/storage/storage.service';
import { ConversationsService } from '../../conversations/conversations.service';
import { RedisService } from 'src/common/redis/redis.service';
import { REDIS_CHANNEL_SOCKET_EVENTS } from 'src/common/constants/redis.constant';
import { SendMessageDto } from '../dto/send-message.dto';
import { SendVoiceMessageDto } from '../dto/send-voice-message.dto';
import { PinnedMessageDto } from '../dto/pinned-message.dto';
import { RecalledMessageDto } from '../dto/recalled-message.dto';
import { DeleteMessageForMeDto } from '../dto/delete-message-for-me.dto';
import { ForwardMessageDto } from '../dto/forward-message.dto';
import { ReactionDto } from '../dto/reaction.dto';
import { RemoveReactionDto } from '../dto/remove-reaction.dto';
import { ReadReceiptDto } from '../dto/read-reciept.dto';
import { ConversationType } from 'src/common/types/enums/conversation-type';
import { MemberRole } from 'src/common/types/enums/member-role';
import { ConversationSetting } from 'src/modules/conversation-settings/schemas/conversation-setting.schema';

import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

ffmpeg.setFfmpegPath(ffmpegPath as string);

@Injectable()
export class MessagesActionService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<Message>,
    @InjectModel(Member.name)
    private readonly memberModel: Model<Member>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<Conversation>,
    private readonly transformService: MessagesTransformService,
    private readonly storageService: StorageService,
    @Inject(forwardRef(() => ConversationsService))
    private readonly conversationService: ConversationsService,
    private readonly redisService: RedisService,
    @InjectModel(ConversationSetting.name)
    private readonly conversationSettingModel: Model<ConversationSetting>,
  ) { }

  async convertToM4A(inputPath: string, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioCodec('aac')
        .audioBitrate(128)
        .audioChannels(1)
        .format('ipod') // chuẩn m4a cho iOS
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .save(outputPath);
    });
  }

  async sendMessage(
    sendMessageDto: SendMessageDto,
    files?: Express.Multer.File[],
  ) {
    try {
      let { senderId, conversationId, content, repliedId } = sendMessageDto;

      if (typeof content === 'string') {
        try {
          content = JSON.parse(content);
        } catch (error) {
          console.error('Failed to parse content JSON:', error);
        }
      }

      const conversation =
        await this.conversationModel.findById(conversationId);
      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }
      const conversationSetting = await this.conversationSettingModel.findOne({
        userId: new Types.ObjectId(senderId),
        conversationId: new Types.ObjectId(conversationId),
      });
      let expiresAt: Date | undefined;
      if (
        conversationSetting?.expireDuration &&
        conversationSetting.expireDuration > 0
      ) {
        expiresAt = new Date(Date.now() + conversationSetting.expireDuration);
      }

      if (sendMessageDto.expireDuration) {
        expiresAt = new Date(Date.now() + sendMessageDto.expireDuration);
      }

      const member = await this.memberModel.findOne({
        userId: new Types.ObjectId(senderId),
        conversationId: new Types.ObjectId(conversationId),
        leftAt: null,
      });

      if (!member) {
        throw new NotFoundException(
          'User is not a participant in this conversation',
        );
      }

      if (
        conversation.type === ConversationType.GROUP &&
        member.role === MemberRole.MEMBER &&
        !conversation.group?.allowMembersSendMessages
      ) {
        throw new BadRequestException(
          'Members are not allowed to send messages in this group',
        );
      }

      if ((content as any)?.voiceDuration != null) {
        throw new BadRequestException(
          'Voice message is not supported in this endpoint. Use POST /messages/voice',
        );
      }

      if (files?.some((f) => f.mimetype?.startsWith('audio/'))) {
        throw new BadRequestException(
          'Voice message is not supported in this endpoint. Use POST /messages/voice',
        );
      }

      const formattedContent: any = {
        text: content?.text ?? null,
        icon: content?.icon ?? null,
        files: [],
        voiceDuration: null,
        storyLink: content?.storyLink ?? null,
      };

      if (files && files.length > 0) {
        formattedContent.files = await Promise.all(
          files.map((file) => this.storageService.uploadFile(file)),
        );
      }

      if (
        !formattedContent.text &&
        !formattedContent.icon &&
        (!formattedContent.files || formattedContent.files.length === 0)
      ) {
        throw new BadRequestException(
          'Message must contain at least text, icon, or file',
        );
      }

      const message = await this.messageModel.create({
        senderId: new Types.ObjectId(senderId),
        conversationId: new Types.ObjectId(conversationId),
        content: formattedContent,
        pinned: false,
        expiresAt,
        recalled: false,
        reactions: [],
        readReceipts: [{ userId: new Types.ObjectId(senderId) }],
        repliedId: repliedId ? new Types.ObjectId(repliedId) : null,
      });

      await this.conversationModel.findByIdAndUpdate(conversationId, {
        lastMessageId: new Types.ObjectId(message._id),
        lastMessageAt: (message as any).createdAt,
      });

      const populatedMessage = (await this.messageModel
        .findById(message._id)
        .populate('senderId', 'profile.name profile.avatarUrl')
        .populate('readReceipts.userId', 'profile.name profile.avatarUrl')
        .populate('reactions.userId', 'profile.name profile.avatarUrl')
        .populate({
          path: 'repliedId',
          populate: {
            path: 'senderId',
            select: 'profile.name profile.avatarUrl',
          },
        })
        .lean()) as any;

      if (populatedMessage) {
        const conversationIdStr = conversationId.toString();
        const transformedMessage =
          this.transformService.transformMessage(populatedMessage);

        await this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
          room: conversationIdStr,
          event: 'new_message',
          data: transformedMessage,
        });

        await this.transformService.emitMessageForMedias(
          conversationIdStr,
          transformedMessage,
        );

        // For multi-instance, we send an internal event to trigger read receipts on all instances
        await this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
          room: conversationIdStr,
          event: 'internal_force_read_receipt',
          data: { senderId, conversationId: conversationId.toString() },
        });
      }

      const members = await this.memberModel.find({
        conversationId: new Types.ObjectId(conversationId),
        leftAt: null,
      });

      for (const m of members) {
        const mId = m.userId.toString();
        // Xóa cache hội thoại của member để lấy tin nhắn mới nhất
        await this.redisService.del(`user:conversations:${mId}`);

        const conversations =
          await this.conversationService.getConversationsFromUser(mId);
        const conv = conversations.find(
          (c) => c.conversationId.toString() === conversationId,
        );
        if (conv) {
          await this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
            room: mId,
            event: 'new_message_sidebar',
            data: conv,
          });
        }
      }

      return message;
    } catch (error) {
      console.log(error);
    }
  }

  async sendVoiceMessage(
    sendVoiceMessageDto: SendVoiceMessageDto,
    files?: Express.Multer.File[],
  ) {
    try {
      let { senderId, conversationId, content, repliedId } =
        sendVoiceMessageDto;

      // parse content
      if (typeof content === 'string') {
        try {
          content = JSON.parse(content);
        } catch (error) {
          console.error('Failed to parse content JSON:', error);
        }
      }

      // validate file
      if (!files || files.length !== 1) {
        throw new BadRequestException(
          'Voice message must contain exactly one audio file',
        );
      }

      const [audioFile] = files;

      if (!audioFile?.mimetype?.startsWith('audio/')) {
        throw new BadRequestException('Uploaded file must be an audio file');
      }

      // validate duration
      const voiceDuration = Number((content as any)?.voiceDuration);
      if (!Number.isFinite(voiceDuration) || voiceDuration <= 0) {
        throw new BadRequestException(
          'voiceDuration must be a positive number',
        );
      }

      // check conversation
      const conversation =
        await this.conversationModel.findById(conversationId);
      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      // check member
      const member = await this.memberModel.findOne({
        userId: new Types.ObjectId(senderId),
        conversationId: new Types.ObjectId(conversationId),
        leftAt: null,
      });

      if (!member) {
        throw new NotFoundException(
          'User is not a participant in this conversation',
        );
      }

      if (
        conversation.type === ConversationType.GROUP &&
        member.role === MemberRole.MEMBER &&
        !conversation.group?.allowMembersSendMessages
      ) {
        throw new BadRequestException(
          'Members are not allowed to send messages in this group',
        );
      }

      let fileToUpload: Express.Multer.File = audioFile;

      if (audioFile.mimetype === 'audio/webm') {
        const tempInputPath = path.join(
          process.cwd(),
          'tmp',
          `${Date.now()}.webm`,
        );

        const tempOutputPath = tempInputPath.replace('.webm', '.m4a');

        // đảm bảo folder tmp tồn tại
        if (!fs.existsSync(path.dirname(tempInputPath))) {
          fs.mkdirSync(path.dirname(tempInputPath), { recursive: true });
        }

        // ghi buffer ra file
        fs.writeFileSync(tempInputPath, audioFile.buffer);

        // convert
        await this.convertToM4A(tempInputPath, tempOutputPath);

        // đọc lại file m4a
        const m4aBuffer = fs.readFileSync(tempOutputPath);

        fileToUpload = {
          ...audioFile,
          buffer: m4aBuffer,
          originalname:
            tempOutputPath.split('/').pop() || `voice-${Date.now()}.m4a`,
          mimetype: 'audio/mp4',
        };

        // cleanup
        fs.unlinkSync(tempInputPath);
        fs.unlinkSync(tempOutputPath);
      }
      const uploaded = await this.storageService.uploadFile(fileToUpload);

      const formattedContent: any = {
        text: null,
        icon: null,
        files: [uploaded],
        voiceDuration,
      };

      const message = await this.messageModel.create({
        senderId: new Types.ObjectId(senderId),
        conversationId: new Types.ObjectId(conversationId),
        content: formattedContent,
        pinned: false,
        recalled: false,
        reactions: [],
        readReceipts: [{ userId: new Types.ObjectId(senderId) }],
        repliedId: repliedId ? new Types.ObjectId(repliedId) : null,
      });

      await this.conversationModel.findByIdAndUpdate(conversationId, {
        lastMessageId: new Types.ObjectId(message._id),
        lastMessageAt: (message as any).createdAt,
      });

      // =========================
      // SOCKET + REDIS
      // =========================
      const populatedMessage = await this.messageModel
        .findById(message._id)
        .populate('senderId', 'profile.name profile.avatarUrl')
        .populate('readReceipts.userId', 'profile.name profile.avatarUrl')
        .populate('reactions.userId', 'profile.name profile.avatarUrl')
        .lean();

      if (populatedMessage) {
        const conversationIdStr = conversationId.toString();
        const transformedMessage =
          this.transformService.transformMessage(populatedMessage);

        await this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
          room: conversationIdStr,
          event: 'new_message',
          data: transformedMessage,
        });

        await this.transformService.emitMessageForMedias(
          conversationIdStr,
          transformedMessage,
        );

        // For multi-instance, we send an internal event to trigger read receipts on all instances
        await this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
          room: conversationIdStr,
          event: 'internal_force_read_receipt',
          data: { senderId, conversationId: conversationId.toString() },
        });
      }

      const members = await this.memberModel.find({
        conversationId: new Types.ObjectId(conversationId),
        leftAt: null,
      });

      for (const m of members) {
        const mId = m.userId.toString();
        // Xóa cache hội thoại của member để lấy tin nhắn mới nhất
        await this.redisService.del(`user:conversations:${mId}`);

        const conversations =
          await this.conversationService.getConversationsFromUser(mId);
        const conv = conversations.find(
          (c) => c.conversationId.toString() === conversationId,
        );
        if (conv) {
          await this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
            room: mId,
            event: 'new_message_sidebar',
            data: conv,
          });
        }
      }

      return message;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async recalledMessage(recalledMessageDto: RecalledMessageDto) {
    const { userId, messageId, conversationId } = recalledMessageDto;

    const objectUserId = new Types.ObjectId(userId);
    const objectMessageId = new Types.ObjectId(messageId);
    const objectConversationId = new Types.ObjectId(conversationId);

    const memberExists = await this.memberModel.exists({
      userId: objectUserId,
      conversationId: objectConversationId,
      leftAt: null,
    });

    if (!memberExists) {
      throw new NotFoundException(
        'User is not a participant in this conversation',
      );
    }

    const message: any = await this.messageModel.findById(objectMessageId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.content?.files) {
      await Promise.all(
        message.content.files.map(async (file) => {
          await this.storageService.deleteFile(file.fileKey);
        }),
      );
    }

    const expireDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await this.messageModel.updateOne(
      {
        _id: objectMessageId,
        conversationId: objectConversationId,
        senderId: objectUserId,
        recalled: false,
        call: null,
        createdAt: { $gte: expireDate },
      },
      {
        $set: { recalled: true, 'content.files': [] },
      },
    );

    if (result.matchedCount === 0) {
      throw new BadRequestException(
        'Message cannot be recalled (not found, expired, already recalled, or not sender)',
      );
    }

    const updatedMessage = await this.messageModel.findById(objectMessageId);
    if (updatedMessage) {
      const conversationIdStr = conversationId.toString();
      const messageIdStr = messageId.toString();

      this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
        room: conversationIdStr,
        event: 'message_recalled',
        data: { messageId: messageIdStr },
      });

      const members = await this.memberModel.find({
        conversationId: new Types.ObjectId(conversationIdStr),
        leftAt: null,
      });

      // Xóa cache hội thoại của các thành viên khi có tin nhắn bị thu hồi
      for (const m of members) {
        await this.redisService.del(`user:conversations:${m.userId.toString()}`);
      }

      members.forEach((m) => {
        this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
          room: m.userId.toString(),
          event: 'message_recalled_sidebar',
          data: {
            conversationId: conversationIdStr,
            messageId: messageIdStr,
          },
        });
      });
    }

    return updatedMessage;
  }

  async deleteMessageForMe(deleteMessageForMeDto: DeleteMessageForMeDto) {
    const { userId, messageId, conversationId } = deleteMessageForMeDto;

    const objectUserId = new Types.ObjectId(userId);
    const objectMessageId = new Types.ObjectId(messageId);
    const objectConversationId = new Types.ObjectId(conversationId);

    const memberExists = await this.memberModel.exists({
      userId: objectUserId,
      conversationId: objectConversationId,
      leftAt: null,
    });

    if (!memberExists) {
      throw new NotFoundException(
        'User is not a participant in this conversation',
      );
    }

    const message = await this.messageModel.findOne({
      _id: objectMessageId,
      conversationId: objectConversationId,
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.deletedFor?.some((id) => id.equals(objectUserId))) {
      return {
        success: true,
        message: 'Message already deleted for this user',
      };
    }

    await this.messageModel.updateOne(
      { _id: objectMessageId },
      { $addToSet: { deletedFor: objectUserId } },
    );

    return { success: true, messageId };
  }

  async forwardMessages(dto: ForwardMessageDto) {
    const objectMessageIds = dto.messageIds.map((id) => new Types.ObjectId(id));
    const messages = await this.messageModel
      .find({ _id: { $in: objectMessageIds } })
      .sort({ createdAt: 1 });

    if (!messages.length) {
      throw new NotFoundException('Messages not found');
    }

    const results: any = [];

    await Promise.all(
      dto.targetConversationIds.map(async (convId) => {
        const objectConvId = new Types.ObjectId(convId);
        const member = await this.memberModel.findOne({
          userId: new Types.ObjectId(dto.userId),
          conversationId: objectConvId,
          leftAt: null,
        });

        if (!member) return;

        for (const msg of messages) {
          if (msg.recalled) continue;

          const newMessage = await this.messageModel.create({
            senderId: new Types.ObjectId(dto.userId),
            conversationId: objectConvId,
            content: msg.content,
            pinned: false,
            recalled: false,
            reactions: [],
            readReceipts: [{ userId: new Types.ObjectId(dto.userId) }],
            repliedId: null,
            forwardFrom: {
              messageId: msg._id,
              senderId: msg.senderId,
              conversationId: msg.conversationId,
            },
          });

          await this.conversationModel.findByIdAndUpdate(objectConvId, {
            lastMessageId: newMessage._id,
            lastMessageAt: (newMessage as any).createdAt,
          });

          const populatedMessage = await this.messageModel
            .findById(newMessage._id)
            .populate('senderId', 'profile.name profile.avatarUrl')
            .populate('readReceipts.userId', 'profile.name profile.avatarUrl')
            .populate('reactions.userId', 'profile.name profile.avatarUrl')
            .lean();

          const transformed =
            this.transformService.transformMessage(populatedMessage);
          const conversationIdStr = convId.toString();

          this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
            room: conversationIdStr,
            event: 'new_message',
            data: transformed,
          });

          // For multi-instance, we send an internal event to trigger read receipts on all instances
          await this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
            room: conversationIdStr,
            event: 'internal_force_read_receipt',
            data: { senderId: dto.userId, conversationId: convId },
          });
          results.push(newMessage);
        }

        const members = await this.memberModel.find({
          conversationId: objectConvId,
          leftAt: null,
        });

        for (const m of members) {
          const mId = m.userId.toString();
          // Xóa cache hội thoại của member để lấy tin nhắn mới nhất
          await this.redisService.del(`user:conversations:${mId}`);

          const conversations =
            await this.conversationService.getConversationsFromUser(mId);
          const conv = conversations.find(
            (c) => c.conversationId.toString() === convId,
          );
          if (conv) {
            this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
              room: mId,
              event: 'new_message_sidebar',
              data: conv,
            });
          }
        }
      }),
    );

    return results;
  }

  async reactionMessage(reactionDto: ReactionDto) {
    const { userId, messageId, conversationId, emojiType } = reactionDto;

    const objectUserId = new Types.ObjectId(userId);
    const objectMessageId = new Types.ObjectId(messageId);
    const objectConversationId = new Types.ObjectId(conversationId);

    const memberExists = await this.memberModel.exists({
      userId: objectUserId,
      conversationId: objectConversationId,
      leftAt: null,
    });

    if (!memberExists) {
      throw new NotFoundException(
        'User is not a participant in this conversation',
      );
    }

    const incResult = await this.messageModel.updateOne(
      {
        _id: objectMessageId,
        conversationId: objectConversationId,
        recalled: false,
        call: null,
        reactions: {
          $elemMatch: {
            userId: objectUserId,
            emoji: { $elemMatch: { name: emojiType } },
          },
        },
      },
      { $inc: { 'reactions.$[r].emoji.$[e].quantity': 1 } },
      {
        arrayFilters: [{ 'r.userId': objectUserId }, { 'e.name': emojiType }],
      },
    );

    if (incResult.modifiedCount > 0) {
      return this._emitReactionUpdate(
        objectMessageId,
        conversationId,
        messageId,
      );
    }

    const pushEmojiResult = await this.messageModel.updateOne(
      {
        _id: objectMessageId,
        conversationId: objectConversationId,
        recalled: false,
        call: null,
        reactions: {
          $elemMatch: {
            userId: objectUserId,
            emoji: { $not: { $elemMatch: { name: emojiType } } },
          },
        },
      },
      {
        $push: { 'reactions.$.emoji': { name: emojiType, quantity: 1 } },
      },
    );

    if (pushEmojiResult.modifiedCount > 0) {
      return this._emitReactionUpdate(
        objectMessageId,
        conversationId,
        messageId,
      );
    }

    const pushUserResult = await this.messageModel.updateOne(
      {
        _id: objectMessageId,
        conversationId: objectConversationId,
        recalled: false,
        call: null,
        'reactions.userId': { $ne: objectUserId },
      },
      {
        $push: {
          reactions: {
            userId: objectUserId,
            emoji: [{ name: emojiType, quantity: 1 }],
          },
        },
      },
    );

    if (pushUserResult.modifiedCount === 0) {
      throw new BadRequestException(
        'Cannot react to this message (not found, recalled, or a call message)',
      );
    }

    return this._emitReactionUpdate(objectMessageId, conversationId, messageId);
  }

  private async _emitReactionUpdate(
    objectMessageId: Types.ObjectId,
    conversationId: string,
    messageId: string,
  ) {
    const updatedMessage = await this.messageModel
      .findById(objectMessageId)
      .populate('reactions.userId', 'profile.name profile.avatarUrl')
      .lean();

    const reactions = (updatedMessage?.reactions || []).map((r) => ({
      ...r,
      userId: this.transformService.signUser(r.userId),
    }));

    this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
      room: conversationId,
      event: 'message_reacted',
      data: { messageId, reactions },
    });

    return updatedMessage;
  }

  async removeReactionMessage(removeReactionDto: RemoveReactionDto) {
    const { userId, messageId, conversationId } = removeReactionDto;

    const objectUserId = new Types.ObjectId(userId);
    const objectMessageId = new Types.ObjectId(messageId);
    const objectConversationId = new Types.ObjectId(conversationId);

    const memberExists = await this.memberModel.exists({
      userId: objectUserId,
      conversationId: objectConversationId,
      leftAt: null,
    });

    if (!memberExists) {
      throw new NotFoundException(
        'User is not a participant in this conversation',
      );
    }

    const result = await this.messageModel.updateOne(
      {
        _id: objectMessageId,
        conversationId: objectConversationId,
        recalled: false,
        call: null,
        'reactions.userId': objectUserId,
      },
      { $pull: { reactions: { userId: objectUserId } } },
    );

    if (result.modifiedCount === 0) {
      throw new BadRequestException(
        'Cannot remove reaction from this message (not found, already removed, recalled, or a call message)',
      );
    }

    const updatedMessage = await this.messageModel
      .findById(objectMessageId)
      .populate('reactions.userId', 'profile.name profile.avatarUrl')
      .lean();

    this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
      room: conversationId.toString(),
      event: 'message_reacted',
      data: {
        messageId: messageId.toString(),
        reactions: updatedMessage?.reactions,
      },
    });

    return updatedMessage;
  }

  async readReceiptMessage(readReceiptDto: ReadReceiptDto) {
    const { userId, conversationId } = readReceiptDto;

    const objectUserId = new Types.ObjectId(userId);
    const objectConversationId = new Types.ObjectId(conversationId);

    const member = await this.memberModel.findOne({
      userId: objectUserId,
      conversationId: objectConversationId,
      leftAt: null,
    });

    if (!member) {
      throw new NotFoundException(
        'User is not a participant in this conversation',
      );
    }

    const conversation = await this.conversationModel.findById(
      objectConversationId,
      { lastMessageId: 1 },
    );

    if (!conversation?.lastMessageId) {
      return { message: 'No messages' };
    }

    const lastMessageId = conversation.lastMessageId;

    if (member.lastReadMessageId?.equals(lastMessageId)) {
      return { message: 'Already read' };
    }

    const updateFilter: any = {
      conversationId: objectConversationId,
      'readReceipts.userId': { $ne: objectUserId },
    };

    if (member.lastReadMessageId) {
      updateFilter._id = { $gt: member.lastReadMessageId };
    }

    await this.messageModel.updateMany(updateFilter, {
      $addToSet: { readReceipts: { userId: objectUserId } },
    });

    const findFilter: any = { conversationId: objectConversationId };
    if (member.lastReadMessageId) {
      findFilter._id = { $gt: member.lastReadMessageId };
    }

    const updatedMessages = await this.messageModel
      .find(findFilter)
      .populate({
        path: 'readReceipts.userId',
        select: '_id profile.name profile.avatarUrl',
      })
      .lean();

    const transformedMessages = updatedMessages.map((msg) => {
      if (msg.readReceipts?.length) {
        return {
          ...msg,
          readReceipts: msg.readReceipts.map((r) => {
            const user = r.userId as any;
            let avatarUrl = user?.profile?.avatarUrl;
            if (avatarUrl && !avatarUrl.startsWith('http')) {
              avatarUrl = this.transformService.signAvatar(avatarUrl);
            }
            return {
              ...r,
              userId: {
                ...user,
                profile: { ...user?.profile, avatarUrl },
              },
            };
          }),
        };
      }
      return msg;
    });

    this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
      room: conversationId.toString(),
      event: 'read_receipt',
      data: {
        conversationId,
        messages: transformedMessages,
      },
    });

    await this.memberModel.updateOne(
      { _id: member._id },
      { $set: { lastReadMessageId: lastMessageId } },
    );

    return {
      conversationId,
      userId,
      lastReadMessageId: lastMessageId,
    };
  }

  async pinnedMessage(pinnedMessageDto: PinnedMessageDto) {
    const { userId, messageId, conversationId } = pinnedMessageDto;

    const session = await this.messageModel.db.startSession();
    session.startTransaction();

    try {
      const objectUserId = new Types.ObjectId(userId);
      const objectMessageId = new Types.ObjectId(messageId);
      const objectConversationId = new Types.ObjectId(conversationId);

      const message = await this.messageModel
        .findById(objectMessageId)
        .session(session);

      if (!message) throw new NotFoundException('Message not found');

      if (message.conversationId.toString() !== conversationId) {
        throw new BadRequestException(
          'Message does not belong to this conversation',
        );
      }

      if (message.call)
        throw new BadRequestException('Cannot pin a call message');
      if (message.recalled)
        throw new BadRequestException('Cannot pin a recalled message');

      const conversation = await this.conversationModel
        .findById(objectConversationId)
        .session(session);

      if (!conversation) throw new NotFoundException('Conversation not found');

      const member = await this.memberModel
        .findOne({
          userId: objectUserId,
          conversationId: objectConversationId,
          leftAt: null,
        })
        .session(session);

      if (!member) {
        throw new NotFoundException(
          'User is not a participant in this conversation',
        );
      }

      if (
        conversation.type === ConversationType.GROUP &&
        member.role === MemberRole.MEMBER
      ) {
        throw new BadRequestException(
          'Members are not allowed to pin messages in group',
        );
      }

      if (!message.pinned) {
        const pinnedCount = await this.messageModel
          .countDocuments({
            conversationId: objectConversationId,
            pinned: true,
          })
          .session(session);

        if (pinnedCount >= 3) {
          throw new BadRequestException('Maximum pinned messages reached');
        }
      }

      message.pinned = !message.pinned;
      await message.save({ session });

      await session.commitTransaction();
      session.endSession();

      const messages = await this.messageModel
        .find({
          conversationId: objectConversationId,
          pinned: true,
          recalled: false,
        })
        .sort({ updatedAt: -1 })
        .populate('senderId', 'profile.name')
        .lean();

      const transformedMessages = messages.map((m) =>
        this.transformService.transformMessage(m),
      );

      this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
        room: conversationId.toString(),
        event: 'message_pinned',
        data: {
          messageId: messageId.toString(),
          pinned: message.pinned,
          pinnedMessages: transformedMessages,
        },
      });

      return message;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  @OnEvent('message.force_read_receipt')
  async handleForceReadReceipt(payload: any) {
    const { userId, conversationId } = payload;
    await this.readReceiptMessage({ userId, conversationId });
  }
}
