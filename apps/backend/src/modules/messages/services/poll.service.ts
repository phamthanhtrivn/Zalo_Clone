import { BadRequestException, Injectable, NotFoundException, Inject, forwardRef } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Poll } from "../schemas/poll.schema";
import { PollVote } from "../schemas/poll-vote.schema";
import { Message } from "../schemas/message.schema";
import { Member } from "../../members/schemas/member.schema";
import { Conversation } from "../../conversations/schemas/conversation.schema";
import { MessagesTransformService } from "./transform.service";
import { RedisService } from "src/common/redis/redis.service";
import { MessagesQueryService } from "./query.service";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";
import { MessageType } from "src/common/enums/message-type.enum";
import { ForbiddenException } from "@nestjs/common";
import { CreatePollDto } from "../dto/create-poll.dto";
import { VotePollDto } from "../dto/vote-poll.dto";
import { REDIS_CHANNEL_SOCKET_EVENTS } from "../../../common/constants/redis.constant";
import { ConversationsService } from "../../conversations/conversations.service";

@Injectable()
export class PollService {
  constructor(
    @InjectModel(Poll.name) private readonly pollModel: Model<Poll>,
    @InjectModel(PollVote.name) private readonly pollVoteModel: Model<PollVote>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    @InjectModel(Member.name) private readonly memberModel: Model<Member>,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
    private readonly redisService: RedisService,
    private readonly transformService: MessagesTransformService,
    private readonly queryService: MessagesQueryService,
    @InjectConnection() private readonly connection: Connection,
    @Inject(forwardRef(() => ConversationsService))
    private readonly conversationService: ConversationsService,
  ) { }

  async createPoll(userId: string, conversationId: string, dto: CreatePollDto) {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      const objectUserId = new Types.ObjectId(userId);
      const objectConvId = new Types.ObjectId(conversationId);

      // 1. Kiểm tra quyền tham gia
      const member = await this.memberModel.findOne({
        userId: objectUserId,
        conversationId: objectConvId,
        leftAt: null,
      }).session(session);
      if (!member) throw new ForbiddenException('You are not in this conversation');

      // 2. Khởi tạo Poll
      const pollOptions = dto.options.map(text => ({
        _id: new Types.ObjectId(),
        text,
        creatorId: objectUserId,
      }));

      const [newPoll] = await this.pollModel.create([{
        conversationId: objectConvId,
        title: dto.title,
        options: pollOptions,
        isMultipleChoice: dto.isMultipleChoice ?? true,
        allowAddOptions: dto.allowAddOptions ?? true,
        isAnonymous: dto.isAnonymous ?? false,
        hideResultsUntilVoted: dto.hideResultsUntilVoted ?? false,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        creatorId: objectUserId,
      }], { session });

      // 3. Tạo Message loại POLL
      const [message] = await this.messageModel.create([{
        senderId: objectUserId,
        conversationId: objectConvId,
        type: MessageType.POLL,
        pollId: newPoll._id,
        content: { text: `📊 Bình chọn: ${dto.title}` },
        readReceipts: [{ userId: objectUserId }],
      }], { session });

      // 4. Update Last Message
      await this.conversationModel.findByIdAndUpdate(objectConvId, {
        lastMessageId: message._id,
        lastMessageAt: (message as any).createdAt,
      }).session(session);

      await session.commitTransaction();

      // Clear cache for messages and sidebar conversation list
      await this.invalidateMessagesCache(conversationId);
      await this.invalidateConversationCacheForMembers(conversationId);

      // 5. Transform & Publish Socket
      const populatedMessage = await this.messageModel
        .findById(message._id)
        .populate('senderId', 'profile.name profile.avatarUrl')
        .populate('pollId')
        .lean();

      const transformed = this.transformService.transformMessage(populatedMessage);
      await this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
        room: conversationId,
        event: 'new_message',
        data: transformed,
      });

      // Emit new_message_sidebar to update sidebar and unread count for all members
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

      return transformed;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async vote(userId: string, conversationId: string, dto: VotePollDto) {
    const objectUserId = new Types.ObjectId(userId);
    const objectPollId = new Types.ObjectId(dto.pollId);

    // 1. Kiểm tra Poll có thuộc Conversation này không và User có quyền không
    const poll = await this.pollModel.findOne({
      _id: objectPollId,
      conversationId: new Types.ObjectId(conversationId)
    });
    if (!poll) throw new NotFoundException('Poll not found in this conversation');

    if (poll.expiresAt && new Date() > poll.expiresAt) {
      throw new BadRequestException('Bình chọn đã kết thúc, không thể thực hiện thao tác này.');
    }

    // Kiểm tra optionIds có thuộc Poll này không
    if (dto.optionIds && dto.optionIds.length > 0) {
      const validOptionIds = new Set(poll.options.map(opt => opt._id.toString()));
      const invalidIds = dto.optionIds.filter(id => !validOptionIds.has(id));
      if (invalidIds.length > 0) {
        throw new BadRequestException(`Invalid optionIds for this poll: ${invalidIds.join(', ')}`);
      }
    }

    // Sử dụng transaction để đảm bảo xóa/thêm vote đồng nhất
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      // 1. Xóa vote cũ
      await this.pollVoteModel.deleteMany({ pollId: objectPollId, userId: objectUserId }).session(session);

      // 2. Thêm vote mới
      if (dto.optionIds && dto.optionIds.length > 0) {
        const votes = dto.optionIds.map(optId => ({
          pollId: objectPollId,
          userId: objectUserId,
          optionId: new Types.ObjectId(optId),
        }));
        await this.pollVoteModel.insertMany(votes, { session });
      }

      await session.commitTransaction();

      // 3. Lấy thống kê mới nhất & Bắn Socket
      await this.redisService.del(`poll:stats:${dto.pollId}`);
      const stats = await this.queryService.getPollStatistics(dto.pollId);
      const transformedStats = this.transformService.transformPoll(stats);

      await this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
        room: conversationId,
        event: 'update_poll',
        data: {
          ...transformedStats,
          _id: dto.pollId,
          conversationId
        },
      });

      return transformedStats;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async addOption(userId: string, conversationId: string, pollId: string, text: string) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const objectPollId = new Types.ObjectId(pollId);
      // Kiểm tra quyền Member trước khi cho phép thêm Option
      const member = await this.memberModel.exists({
        userId: new Types.ObjectId(userId),
        conversationId: new Types.ObjectId(conversationId),
        leftAt: null
      }).session(session);

      if (!member) throw new ForbiddenException('You are not in this conversation');

      // Kiểm tra Poll có thuộc Group không
      const poll = await this.pollModel.findOne({
        _id: new Types.ObjectId(pollId),
        conversationId: new Types.ObjectId(conversationId)
      }).session(session);

      if (!poll || !poll.allowAddOptions) {
        throw new BadRequestException('Cannot add options to this poll');
      }

      if (poll.expiresAt && new Date() > poll.expiresAt) {
        throw new BadRequestException('Bình chọn đã kết thúc, không thể thực hiện thao tác này.');
      }

      const newOption = {
        _id: new Types.ObjectId(),
        text,
        creatorId: new Types.ObjectId(userId),
      };

      await this.pollModel.findByIdAndUpdate(objectPollId, {
        $push: { options: newOption }
      }).session(session);

      await this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
        room: conversationId,
        event: 'poll_option_added',
        data: {
          pollId: pollId.toString(),
          newOption,
          conversationId: conversationId.toString()
        },
      });

      await session.commitTransaction();
      await this.redisService.del(`poll:stats:${pollId}`);
      return newOption;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  private async invalidateMessagesCache(conversationId: string) {
    try {
      const client = this.redisService.getClient();

      // 1. Invalidate messages page cache
      const messagesPattern = `user:conv:${conversationId}:messages:*`;
      const messagesKeys = await client.keys(messagesPattern);
      if (messagesKeys.length > 0) {
        await client.del(...messagesKeys);
      }

      // 2. Invalidate media preview cache
      const mediaPattern = `user:media-preview:${conversationId}:*`;
      const mediaKeys = await client.keys(mediaPattern);
      if (mediaKeys.length > 0) {
        await client.del(...mediaKeys);
      }
    } catch (err) {
      console.error('Failed to invalidate messages cache in poll service:', err);
    }
  }

  private async invalidateConversationCacheForMembers(conversationId: string) {
    try {
      const members = await this.memberModel.find({
        conversationId: new Types.ObjectId(conversationId),
        leftAt: null,
      });
      for (const m of members) {
        await this.redisService.del(`user:conversations:${m.userId.toString()}`);
      }
    } catch (err) {
      console.error('Failed to invalidate conversation cache for members in poll service:', err);
    }
  }
}