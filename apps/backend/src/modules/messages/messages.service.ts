/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message } from './schemas/message.schema';
import { SendMessageDto } from './dto/send-message.dto';
import { SendVoiceMessageDto } from './dto/send-voice-message.dto';
import { Member } from '../members/schemas/member.schema';
import { Conversation } from '../conversations/schemas/conversation.schema';
import { PinnedMessageDto } from './dto/pinned-message.dto';
import { RecalledMessageDto } from './dto/recalled-message.dto';
import { ReactionDto } from './dto/reaction.dto';
import { RemoveReactionDto } from './dto/remove-reaction.dto';
import { ReadReceiptDto } from './dto/read-reciept.dto';
import { CallMessageDto } from './dto/call-message.dto';
import { UpdateCallMessageDto } from './dto/update-call-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { GetMediasPreviewDto } from './dto/get-medias-preview.dto';
import { GetMediasFileTypeDto } from './dto/get-medias-file-type.dto';

import { GetPinnedMessagesDto } from './dto/get-pinned-messages.dto';
import { GetAroundPinnedMessage } from './dto/get-around-pinned-message.dto';
import { DeleteMessageForMeDto } from './dto/delete-message-for-me.dto';
import { ForwardMessageDto } from './dto/forward-message.dto';
import { SearchMessagesDto } from './dto/search-messages.dto';

import { MessagesQueryService } from './services/query.service';
import { MessagesActionService } from './services/action.service';
import { MessagesCallService } from './services/call.service';
import { ConversationSetting } from '../conversation-settings/schemas/conversation-setting.schema';
import { ConversationsService } from '../conversations/conversations.service';
import { ChatGateway } from '../chat/chat.gateway';
import { StorageService } from 'src/common/storage/storage.service';
import { MessageResponse } from './types/message-response.type';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AiService } from '../ai/ai.service';
import { RedisService } from 'src/common/redis/redis.service';
import { REDIS_CHANNEL_SOCKET_EVENTS } from 'src/common/constants/redis.constant';
import { ConversationType } from 'src/common/types/enums/conversation-type';
import { MessageType } from 'src/common/enums/message-type.enum';
import { parseMessageText } from './helpers/parseMessageText';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MessagesService {
  private BOT_ID: string;

  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<Message>,
    @InjectModel(Member.name)
    private readonly memberModel: Model<Member>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<Conversation>,
    private readonly storageService: StorageService,
    @InjectModel(ConversationSetting.name)
    private readonly conversationSettingModel: Model<ConversationSetting>,
    @Inject(forwardRef(() => ConversationsService))
    private readonly conversationService: ConversationsService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
    private readonly queryService: MessagesQueryService,
    private readonly actionService: MessagesActionService,
    private readonly callService: MessagesCallService,
    private readonly aiService: AiService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.BOT_ID = configService.get<string>('ai.botId')!;
  }

  async getMessagesFromConversation(
    conversationId: string,
    getMessagesDto: GetMessagesDto,
  ) {
    return this.queryService.getMessagesFromConversation(
      conversationId,
      getMessagesDto,
    );
  }

  async getNewerMessages(
    conversationId: string,
    getMessagesDto: GetMessagesDto,
  ) {
    return this.queryService.getNewerMessages(conversationId, getMessagesDto);
  }
  async getMessagesAroundPinnedMessage(
    conversationId: string,
    getAroundPinnedMessage: GetAroundPinnedMessage,
  ) {
    return this.queryService.getMessagesAroundPinnedMessage(
      conversationId,
      getAroundPinnedMessage,
    );
  }

  async getPinnedMessagesFromConversation(
    conversationId: string,
    getPinnedMessagesDto: GetPinnedMessagesDto,
  ) {
    return this.queryService.getPinnedMessagesFromConversation(
      conversationId,
      getPinnedMessagesDto,
    );
  }

  async getMediasPreview(
    conversationId: string,
    getMediasPreviewDto: GetMediasPreviewDto,
  ) {
    return this.queryService.getMediasPreview(
      conversationId,
      getMediasPreviewDto,
    );
  }

  async getMediasFileType(
    conversationId: string,
    getMediasFileTypeDto: GetMediasFileTypeDto,
  ) {
    return this.queryService.getMediasFileType(
      conversationId,
      getMediasFileTypeDto,
    );
  }

  async searchMessages(conversationId: string, searchDto: SearchMessagesDto) {
    return this.queryService.searchMessages(conversationId, searchDto);
  }

  async sendVoiceMessage(
    sendVoiceMessageDto: SendVoiceMessageDto,
    files?: Express.Multer.File[],
  ) {
    return this.actionService.sendVoiceMessage(sendVoiceMessageDto, files);
  }

  async getPollMessagesFromConversation(
    conversationId: string,
    userId: string,
  ) {
    return this.queryService.getPollMessagesFromConversation(
      conversationId,
      userId,
    );
  }

  async sendStandardMessage(
    sendMessageDto: SendMessageDto,
    files?: Express.Multer.File[],
  ) {
    return this.actionService.sendMessage(sendMessageDto, files);
  }

  // --- Action Methods ---
  // async sendMessage(
  //   sendMessageDto: SendMessageDto,
  //   files?: Express.Multer.File[],
  // ) {
  //   return this.actionService.sendMessage(sendMessageDto, files);
  // }

  async createCallMessage(callMessageDto: CallMessageDto) {
    return this.callService.createCallMessage(callMessageDto);
  }

  async updateCallMessage(updateCallMessageDto: UpdateCallMessageDto) {
    return this.callService.updateCallMessage(updateCallMessageDto);
  }
  async recalledMessage(recalledMessageDto: RecalledMessageDto) {
    return this.actionService.recalledMessage(recalledMessageDto);
  }

  async deleteMessageForMe(deleteMessageForMeDto: DeleteMessageForMeDto) {
    return this.actionService.deleteMessageForMe(deleteMessageForMeDto);
  }

  async forwardMessages(dto: ForwardMessageDto) {
    return this.actionService.forwardMessages(dto);
  }

  async reactionMessage(reactionDto: ReactionDto) {
    return this.actionService.reactionMessage(reactionDto);
  }

  async removeReactionMessage(removeReactionDto: RemoveReactionDto) {
    return this.actionService.removeReactionMessage(removeReactionDto);
  }

  async readReceiptMessage(readReceiptDto: ReadReceiptDto) {
    return this.actionService.readReceiptMessage(readReceiptDto);
  }

  async pinnedMessage(pinnedMessageDto: PinnedMessageDto) {
    return this.actionService.pinnedMessage(pinnedMessageDto);
  }
  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleExpiredMessages() {
    const now = new Date();

    const expiredMessages = await this.messageModel.find({
      expiresAt: { $lte: now },
      expired: false,
    });

    if (!expiredMessages.length) return;

    const ids = expiredMessages.map((m) => m._id);

    await this.messageModel.updateMany(
      { _id: { $in: ids } },
      { $set: { expired: true } },
    );

    const grouped = expiredMessages.reduce(
      (acc, m) => {
        const key = m.conversationId.toString();
        if (!acc[key]) acc[key] = [];
        acc[key].push(m._id.toString());
        return acc;
      },
      {} as Record<string, string[]>,
    );

    for (const [convId, messageIds] of Object.entries(grouped)) {
      this.chatGateway.server
        .to(convId)
        .emit('messages_expired', { conversationId: convId, messageIds });
    }
  }
  // async checkExpiredMessages() {
  //   const now = new Date();

  //   const expiredMessages = await this.messageModel.find({
  //     expiresAt: { $lte: now, $ne: null },
  //   });

  //   if (!expiredMessages.length) return;

  //   const ids = expiredMessages.map((m) => m._id.toString());
  //   expiredMessages.forEach(m => {
  //     this.chatGateway.server.to(m.conversationId.toString()).emit('messages_expired', { messageIds: [m._id.toString()] });
  //   });
  //   console.log('Expired messages:', ids);
  // }
  // Thêm vào cuối class MessagesService, trước dấu ngoặc đóng }
  // messages.service.ts
  // messages.service.ts
  async getConversationMembers(conversationId: string) {
    const members = await this.memberModel
      .find({
        conversationId: new Types.ObjectId(conversationId),
        leftAt: null,
      })
      .populate('userId', '_id')
      .lean();

    // Lấy lastMessage của conversation
    const conversation = await this.conversationModel
      .findById(conversationId)
      .select('lastMessageId')
      .lean();

    if (!conversation?.lastMessageId) {
      return members.map((m) => ({
        userId: m.userId,
        unreadCount: 0,
      }));
    }

    // Tính unreadCount cho từng member
    const membersWithUnread = await Promise.all(
      members.map(async (member) => {
        // Đếm số messages chưa đọc (messages mới hơn lastReadMessageId và không phải do user tự gửi)
        const unreadCount = await this.messageModel.countDocuments({
          conversationId: new Types.ObjectId(conversationId),
          _id: { $gt: member.lastReadMessageId || new Types.ObjectId() },
          senderId: { $ne: member.userId._id }, // Không tính messages do chính user gửi
          recalled: false,
        });

        return {
          userId: member.userId,
          unreadCount,
        };
      }),
    );

    return membersWithUnread;
  }
  async getUpdatedMessagesAfterReadReceipt(
    conversationId: string,
    userId: string,
    lastReadMessageId: Types.ObjectId | null,
  ): Promise<any[]> {
    return this.queryService.getUpdatedMessagesAfterReadReceipt(
      conversationId,
      userId,
      lastReadMessageId,
    );
  }
  async markAsUnread(userId: string, conversationId: string) {
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
      return {
        success: true,
        message: 'No messages',
        lastReadMessageId: null,
        unreadCount: 0,
        messagesToUpdate: [],
      };
    }

    const messages = await this.messageModel
      .find({
        conversationId: objectConversationId,
        senderId: { $ne: userId },
      })
      .sort({ _id: -1 })
      .limit(2);

    const prevMessage = messages[1] || null;

    // 1️⃣ Cập nhật lastReadMessageId
    await this.memberModel.updateOne(
      { _id: member._id },
      { $set: { lastReadMessageId: prevMessage?._id ?? null } },
    );

    // 2️⃣ Xóa readReceipts của user từ các messages sau prevMessage
    const findFilter: any = {
      conversationId: objectConversationId,
      readReceipts: { $elemMatch: { userId: objectUserId } },
    };

    if (prevMessage) {
      findFilter._id = { $gt: prevMessage._id };
    }

    await this.messageModel.updateMany(findFilter, {
      $pull: {
        readReceipts: { userId: objectUserId },
      },
    });

    // 3️⃣ Lấy danh sách messages cần cập nhật UI
    const messagesToUpdateFilter: any = {
      conversationId: objectConversationId,
    };
    if (prevMessage) {
      messagesToUpdateFilter._id = { $gt: prevMessage._id };
    }

    const messagesToUpdate = await this.messageModel
      .find(messagesToUpdateFilter)
      .populate({
        path: 'readReceipts.userId',
        model: 'User', // ✅ Đảm bảo đúng model name
        select: '_id profile.name profile.avatarUrl',
      })
      .lean();

    // ✅ Log chi tiết để debug
    // console.log('📊 messagesToUpdate details:');
    // for (const msg of messagesToUpdate) {
    //   console.log(`  Message ${msg._id}:`);
    //   for (const receipt of msg.readReceipts || []) {
    //     console.log(`    - User ${receipt.userId?._id}: avatar=${receipt.userId?.profile?.avatarUrl}`);
    //   }
    // }
    return {
      success: true,
      unreadCount: 1,
      lastReadMessageId: prevMessage?._id ?? null,
      lastMessageId: conversation.lastMessageId,
      messagesToUpdate: messagesToUpdate.map((m) => ({
        _id: m._id,
        readReceipts: m.readReceipts,
      })),
    };
  }

  //HaThanhTuan
  // gọi đến api send message là gọi đến hàm này
  async handleIncomingMessage(
    dto: SendMessageDto,
    files?: Express.Multer.File[],
  ) {
    const userText = parseMessageText(dto.content);
    if (userText.startsWith('@Zola AI')) {
      return this.processMessageWithAiStream(dto, files, '10', true);
    }

    // Kiểm tra hội thoại AI 1-1 qua Cache
    const cacheKey = `is_ai_conv:${dto.conversationId}`;
    let isAi = await this.redisService.get(cacheKey);

    if (isAi === null) {
      const conv = await this.conversationModel
        .findById(dto.conversationId)
        .lean();
      isAi = conv?.type === ConversationType.AI ? 'true' : 'false';
      await this.redisService.set(cacheKey, isAi, 'EX', 86400);
    }

    if (isAi === 'true') {
      return this.processMessageWithAiStream(dto, files);
    }

    //Tin nhắn bình thường
    return this.actionService.sendMessage(dto, files);
  }

  //chat with AI
  async processMessageWithAiStream(
    dto: SendMessageDto,
    files?: Express.Multer.File[],
    limit: string = '10',
    isPrivate: boolean = false,
  ) {
    const { conversationId, senderId } = dto;
    const userText = parseMessageText(dto.content);

    // Xác định đích đến của Socket: Cá nhân hoặc Cả nhóm
    const targetId = isPrivate ? senderId : conversationId;

    // 1. Lưu tin nhắn gửi của User (Thầm lặng hoặc Công khai)
    const userMessage = isPrivate
      ? await this.sendPrivateAiSummary(
        conversationId,
        senderId,
        userText,
        MessageType.PRIVATE,
        senderId,
      )
      : await this.actionService.sendMessage(dto, files);

    // CHẠY NGẦM: Không dùng await cho phần xử lý AI phía dưới để tránh timeout cho Mobile
    (async () => {
      try {
        await this.chatGateway.emitAiStatus(targetId, 'thinking');

        // Lấy và map lịch sử hội thoại
        const rawHistory = await this.getMessagesFromConversation(
          conversationId,
          { userId: senderId, limit },
        );
        const mappedHistory = rawHistory.messages
          .filter((msg) => {
            if (!msg.senderId || !msg.senderId._id) return false;
            const isBot = msg.senderId._id.toString() === this.BOT_ID;
            if (isPrivate && isBot) return false;
            return true;
          })
          .map((msg) => {
            const isBot = msg.senderId._id.toString() === this.BOT_ID;
            const senderName = msg.senderId.profile?.name || 'Người dùng';
            const messageText = parseMessageText(msg.content);

            return {
              role: (isBot ? 'assistant' : 'user') as 'assistant' | 'user',
              content: isBot ? messageText : `${senderName}: ${messageText}`,
            };
          })
          .filter((m) => m.content !== '');

        if (mappedHistory.length > 0) mappedHistory.pop();

        const knowledgeContext =
          await this.aiService.findRelevantContext(userText);

        const augmentedPrompt = `
          Dựa trên thông tin sau đây về hệ thống Zola:
          "${knowledgeContext}"
          
          Hãy trả lời câu hỏi của người dùng: ${userText}
        `;

        const aiResponse = await this.aiService.chatStreamAndEmit(
          augmentedPrompt,
          targetId,
          mappedHistory,
        );

        if (isPrivate) {
          await this.sendPrivateAiSummary(
            conversationId,
            this.BOT_ID,
            aiResponse,
            MessageType.AI_SUMMARY,
            senderId,
          );
        } else {
          const botMessage = await this.messageModel.create({
            senderId: new Types.ObjectId(this.BOT_ID),
            conversationId: new Types.ObjectId(conversationId),
            content: { text: aiResponse },
            type: MessageType.USER_MESSAGE,
          });

          await this.conversationModel.findByIdAndUpdate(conversationId, {
            lastMessageId: botMessage._id,
            lastMessageAt: (botMessage as any).createdAt,
          });

          const populatedBotMsg = await this.messageModel
            .findById(botMessage._id)
            .populate('senderId', 'profile.name profile.avatarUrl')
            .lean();

          if (populatedBotMsg?.senderId?.['profile']?.avatarUrl) {
            const avatarUrl = populatedBotMsg.senderId['profile'].avatarUrl;
            if (avatarUrl && !avatarUrl.startsWith('http')) {
              populatedBotMsg.senderId['profile'].avatarUrl = this.storageService.signFileUrl(avatarUrl);
            }
          }

          await this.chatGateway.emitNewMessage(
            conversationId,
            populatedBotMsg,
          );
        }
      } catch (error) {
        console.error('AI Processing Error:', error);
        await this.chatGateway.emitAiStatus(targetId, null);
      }
    })();

    return userMessage;
  }

  async sendPrivateAiSummary(
    conversationId: string,
    senderId: string,
    text: string,
    type: MessageType = MessageType.AI_SUMMARY,
    targetUserId: string,
  ) {
    const message = await this.messageModel.create({
      senderId: new Types.ObjectId(senderId),
      conversationId: new Types.ObjectId(conversationId),
      type,
      content: { text },
      targetUserId: new Types.ObjectId(targetUserId),
    });

    // populate senderId để FE lấy được Avatar/Name
    const populatedMessage = await this.messageModel
      .findById(message._id)
      .populate('senderId', 'profile.name profile.avatarUrl')
      .lean();

    if (populatedMessage?.senderId?.['profile']?.avatarUrl) {
      const avatarUrl = populatedMessage.senderId['profile'].avatarUrl;
      if (avatarUrl && !avatarUrl.startsWith('http')) {
        populatedMessage.senderId['profile'].avatarUrl =
          this.storageService.signFileUrl(avatarUrl);
      }
    }

    await this.chatGateway.emitNewMessage(targetUserId, populatedMessage);
    return populatedMessage;
  }
}
