import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message } from '../schemas/message.schema';
import { Member } from '../../members/schemas/member.schema';
import { Conversation } from '../../conversations/schemas/conversation.schema';
import { MessagesTransformService } from './transform.service';
import { GetMessagesDto } from '../dto/get-messages.dto';
import { GetAroundPinnedMessage } from '../dto/get-around-pinned-message.dto';
import { GetPinnedMessagesDto } from '../dto/get-pinned-messages.dto';
import { GetMediasPreviewDto } from '../dto/get-medias-preview.dto';
import { GetMediasFileTypeDto } from '../dto/get-medias-file-type.dto';
import { MessageResponse } from '../types/message-response.type';
import { FileType } from 'src/common/types/enums/file-type';
import { StorageService } from 'src/common/storage/storage.service';
import { ConversationSetting } from 'src/modules/conversation-settings/schemas/conversation-setting.schema';
import { SearchMessagesDto } from '../dto/search-messages.dto';
import { Poll } from '../schemas/poll.schema';
import { PollVote } from '../schemas/poll-vote.schema';
import { RedisService } from 'src/common/redis/redis.service';
import { MessageType } from 'src/common/enums/message-type.enum';

@Injectable()
export class MessagesQueryService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<Message>,
    @InjectModel(Member.name)
    private readonly memberModel: Model<Member>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<Conversation>,
    private readonly transformService: MessagesTransformService,
    private readonly storageService: StorageService,
    @InjectModel(ConversationSetting.name)
    private readonly conversationSettingModel: Model<ConversationSetting>,
    @InjectModel(Poll.name)
    private readonly pollModel: Model<Poll>,
    @InjectModel(PollVote.name)
    private readonly pollVoteModel: Model<PollVote>,
    private readonly redisService: RedisService,
  ) { }

  private async enrichPollMessages(messages: any[]) {
    return await Promise.all(
      messages.map(async (msg) => {
        if (msg.type === MessageType.POLL && msg.pollId) {
          const pollId = msg.pollId._id?.toString() || msg.pollId.toString();
          const stats = await this.getPollStatistics(pollId);
          if (stats) {
            return { ...msg, pollId: stats };
          }
        }
        return msg;
      }),
    );
  }

  async getMessagesFromConversation(
    conversationId: string,
    getMesssagesDto: GetMessagesDto,
  ) {
    const { userId, cursor, limit = '15' } = getMesssagesDto;

    const conversationObjectId = new Types.ObjectId(conversationId);
    const userObjectId = new Types.ObjectId(userId);

    // Chỉ cache tin nhắn ở trang đầu (cursor rỗng)
    const cacheKey = `user:conv:${conversationId}:messages:${userId}:${limit}`;
    const canUseCache = !cursor;

    if (canUseCache) {
      try {
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (err) {
        console.error('Failed to get messages cache from Redis:', err);
      }
    }

    const member = await this.memberModel.findOne({
      userId: userObjectId,
      conversationId: conversationObjectId,
      leftAt: null,
    });

    if (!member) {
      throw new NotFoundException(
        'User is not a participant in this conversation',
      );
    }
    const setting = await this.conversationSettingModel.findOne({
      userId: userObjectId,
      conversationId: conversationObjectId,
    });
    const query: Record<string, any> = {
      conversationId: conversationObjectId,
      deletedFor: { $ne: userObjectId },
    };

    //Thanh Tuấn viết
    query.$or = [
      { type: { $nin: [MessageType.AI_SUMMARY, MessageType.PRIVATE] } },
      { targetUserId: userObjectId },
    ];

    if (cursor) {
      query._id = { $lt: new Types.ObjectId(cursor) };
    }

    if (setting?.clearAt) {
      query.createdAt = { $gt: setting.clearAt };
    }
    const messages = await this.messageModel
      .find(query)
      .sort({ _id: -1 })
      .limit(Number(limit))
      .populate('senderId', 'profile.name profile.avatarUrl')
      .populate('pollId')
      .populate('readReceipts.userId', 'profile.name profile.avatarUrl')
      .populate('reactions.userId', 'profile.name profile.avatarUrl')
      .populate({
        path: 'repliedId',
        populate: {
          path: 'senderId',
          select: 'profile.name profile.avatarUrl',
        },
      })
      .lean<MessageResponse[]>();

    const enrichedMessages = await this.enrichPollMessages(messages);

    const transformedMessages = enrichedMessages.map((message) =>
      this.transformService.transformMessage(message),
    );

    const finalMessages = transformedMessages.reverse();

    const result = {
      messages: finalMessages,
      nextCursor:
        transformedMessages.length > 0 ? transformedMessages[0]._id : null,
    };

    if (canUseCache) {
      try {
        await this.redisService.set(cacheKey, JSON.stringify(result), 'EX', 3600);
      } catch (err) {
        console.error('Failed to set messages cache in Redis:', err);
      }
    }

    return result;
  }

  async getNewerMessages(
    conversationId: string,
    getMessagesDto: GetMessagesDto,
  ) {
    const { userId, cursor, limit = '15' } = getMessagesDto;

    const conversationObjectId = new Types.ObjectId(conversationId);
    const userObjectId = new Types.ObjectId(userId);

    const member = await this.memberModel.findOne({
      userId: userObjectId,
      conversationId: conversationObjectId,
      leftAt: null,
    });

    if (!member) {
      throw new NotFoundException(
        'User is not a participant in this conversation',
      );
    }

    const cursorObjectId = new Types.ObjectId(cursor);

    const messages = await this.messageModel
      .find({
        conversationId: conversationObjectId,
        _id: { $gt: cursorObjectId },
        deletedFor: { $ne: userObjectId },
      })
      .sort({ _id: 1 })
      .limit(Number(limit))
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
      .lean<MessageResponse[]>();

    const enrichedMessages = await this.enrichPollMessages(messages);

    const transformedMessages = enrichedMessages.map((message) =>
      this.transformService.transformMessage(message),
    );

    return {
      messages: transformedMessages,
      prevCursor:
        transformedMessages.length > 0
          ? transformedMessages[transformedMessages.length - 1]._id
          : null,
    };
  }

  async getMessagesAroundPinnedMessage(
    conversationId: string,
    getAroundPinnedMessage: GetAroundPinnedMessage,
  ) {
    const { userId, messageId, limit = '15' } = getAroundPinnedMessage;

    const conversationObjectId = new Types.ObjectId(conversationId);
    const userObjectId = new Types.ObjectId(userId);

    const member = await this.memberModel.findOne({
      userId: userObjectId,
      conversationId: conversationObjectId,
      leftAt: null,
    });

    if (!member) {
      throw new NotFoundException(
        'User is not a participant in this conversation',
      );
    }

    const target = await this.messageModel.findById(messageId);

    if (!target) {
      throw new NotFoundException('Message not found');
    }

    const half = Math.floor(Number(limit) / 2);

    const [older, targetMessage, newer] = await Promise.all([
      this.messageModel
        .find({
          conversationId: target.conversationId,
          deletedFor: { $ne: userObjectId },
          _id: { $lt: target._id },
        })
        .sort({ _id: -1 })
        .limit(half)
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
        .lean(),

      this.messageModel
        .findById(messageId)
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
        .lean(),

      this.messageModel
        .find({
          conversationId: target.conversationId,
          _id: { $gt: target._id },
          deletedFor: { $ne: userObjectId },
        })
        .sort({ _id: 1 })
        .limit(half)
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
        .lean(),
    ]);

    const messages = [...older.reverse(), targetMessage, ...newer].filter(
      (m): m is NonNullable<typeof m> => m !== null,
    );

    const enrichedMessages = await this.enrichPollMessages(messages);

    const transformed = enrichedMessages.map((message) =>
      this.transformService.transformMessage(message),
    );

    return {
      messages: transformed,
      targetId: messageId,
      nextCursor: transformed[0]?._id,
      prevCursor: transformed[transformed.length - 1]?._id,
    };
  }

  async getPinnedMessagesFromConversation(
    conversationId: string,
    getPinnedMessagesDto: GetPinnedMessagesDto,
  ) {
    const { userId } = getPinnedMessagesDto;

    const conversationObjectId = new Types.ObjectId(conversationId);
    const userObjectId = new Types.ObjectId(userId);

    const member = await this.memberModel.findOne({
      userId: userObjectId,
      conversationId: conversationObjectId,
      leftAt: null,
    });

    if (!member) {
      throw new NotFoundException(
        'User is not a participant in this conversation',
      );
    }

    const messages = await this.messageModel
      .find({
        conversationId: conversationObjectId,
        deletedFor: { $ne: userObjectId },
        pinned: true,
        recalled: false,
        type: MessageType.USER_MESSAGE,
      })
      .sort({ _id: -1 })
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
      .lean();

    const enrichedMessages = await this.enrichPollMessages(messages);

    const transformedMessages = enrichedMessages.map((message) =>
      this.transformService.transformMessage(message),
    );

    const finalMessages = transformedMessages.reverse();

    return {
      messages: finalMessages,
    };
  }

  async getMediasPreview(
    conversationId: string,
    getMediasPreviewDto: GetMediasPreviewDto,
  ) {
    const { userId } = getMediasPreviewDto;

    const cacheKey = `user:media-preview:${conversationId}:${userId}`;
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.error('Failed to get media preview cache from Redis:', err);
    }

    const member = await this.memberModel.findOne({
      userId: new Types.ObjectId(userId),
      conversationId: new Types.ObjectId(conversationId),
      leftAt: null,
    });

    if (!member) {
      throw new NotFoundException(
        'User is not a participant in this conversation',
      );
    }

    const [imagesVideosRaw, filesRaw, rawLinks] = await Promise.all([
      this.messageModel
        .find({
          conversationId: new Types.ObjectId(conversationId),
          'content.files.type': { $in: ['IMAGE', 'VIDEO'] },
        })
        .select('_id content.files createdAt')
        .sort({ _id: -1 })
        .limit(20)
        .lean(),

      this.messageModel
        .find({
          conversationId: new Types.ObjectId(conversationId),
          'content.files.type': 'FILE',
        })
        .select('_id content.files createdAt')
        .sort({ _id: -1 })
        .limit(10)
        .lean(),

      this.messageModel
        .find({
          conversationId: new Types.ObjectId(conversationId),
          deletedFor: { $ne: new Types.ObjectId(userId) },
          'content.text': { $regex: /(https?:\/\/[^\s]+)/ },
        })
        .select('_id content.text createdAt')
        .sort({ _id: -1 })
        .limit(20)
        .lean(),
    ]);

    const images_videos = imagesVideosRaw
      .flatMap((msg: any) =>
        (msg.content?.files || [])
          .filter((f) => f.type === 'IMAGE' || f.type === 'VIDEO')
          .map((file) => ({
            _id: msg._id,
            createdAt: msg.createdAt,
            content: { file },
          })),
      )
      .slice(0, 6);

    const files = filesRaw
      .flatMap((msg: any) =>
        (msg.content?.files || [])
          .filter((f) => f.type === 'FILE')
          .map((file) => ({
            _id: msg._id,
            createdAt: msg.createdAt,
            content: { file },
          })),
      )
      .slice(0, 3);

    const links = rawLinks.flatMap((msg: any) => {
      const matches = msg.content?.text?.match(/https?:\/\/[^\s]+/g) || [];

      return matches.map((url: string) => ({
        _id: msg._id,
        createdAt: msg.createdAt,
        content: { text: url },
      }));
    });

    const signMessageFile = (message: any) => {
      if (message.content?.file) {
        message.content.file.fileKey = this.storageService.signFileUrl(
          message.content.file.fileKey,
        );
      }
      return message;
    };

    const result = {
      images_videos: images_videos.map(signMessageFile),
      files: files.map(signMessageFile),
      links,
    };

    try {
      await this.redisService.set(cacheKey, JSON.stringify(result), 'EX', 3600);
    } catch (err) {
      console.error('Failed to set media preview cache in Redis:', err);
    }

    return result;
  }

  async getMediasFileType(
    conversationId: string,
    getMediasFileTypeDto: GetMediasFileTypeDto,
  ) {
    const {
      userId,
      type,
      cursor,
      limit = '15',
      senderId,
      fromDate,
      toDate,
    } = getMediasFileTypeDto;

    const member = await this.memberModel.findOne({
      userId: new Types.ObjectId(userId),
      conversationId: new Types.ObjectId(conversationId),
      leftAt: null,
    });

    if (!member) {
      throw new NotFoundException(
        'User is not a participant in this conversation',
      );
    }

    const query: any = {
      conversationId: new Types.ObjectId(conversationId),
      deletedFor: { $ne: new Types.ObjectId(userId) },
    };

    if (type === FileType.IMAGE || type === FileType.VIDEO) {
      query['content.files.type'] = { $in: ['IMAGE', 'VIDEO'] };
    } else if (type === FileType.FILE) {
      query['content.files.type'] = 'FILE';
    } else if (type === 'LINK') {
      query['content.text'] = { $regex: /(http|https):\/\// };
    }

    if (senderId) query.senderId = new Types.ObjectId(senderId);

    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    if (cursor) query._id = { $lt: new Types.ObjectId(cursor) };

    const messages = await this.messageModel
      .find(query)
      .sort({ _id: -1 })
      .limit(Number(limit) + 1)
      .lean();

    const results: any[] = [];

    messages.forEach((msg: any) => {
      if (type === 'LINK') {
        const matches = msg.content?.text?.match(/https?:\/\/[^\s]+/g) || [];
        matches.forEach((url: string) => {
          results.push({
            _id: msg._id,
            createdAt: msg.createdAt,
            content: { text: url },
          });
        });
      } else {
        const files = (msg.content?.files || []).filter((f: any) => {
          if (type === FileType.IMAGE || type === FileType.VIDEO) {
            return f.type === 'IMAGE' || f.type === 'VIDEO';
          }
          return f.type === type;
        });

        files.forEach((file: any) => {
          results.push({
            _id: msg._id,
            createdAt: msg.createdAt,
            content: { file: this.transformService.signFile(file) },
          });
        });
      }
    });

    const paginatedResults = results.slice(0, Number(limit));
    const nextCursor =
      results.length > Number(limit) ? results[results.length - 1]._id : null;

    return {
      messages: paginatedResults,
      nextCursor,
    };
  }
  async getUpdatedMessagesAfterReadReceipt(
    conversationId: string,
    userId: string,
    lastReadMessageId: Types.ObjectId | null,
  ): Promise<any[]> {
    const objectConversationId = new Types.ObjectId(conversationId);
    const objectUserId = new Types.ObjectId(userId);

    const findFilter: any = {
      conversationId: objectConversationId,
    };

    if (lastReadMessageId) {
      findFilter._id = { $lte: lastReadMessageId };
    }

    const messages = await this.messageModel
      .find(findFilter)
      .populate('readReceipts.userId', '_id profile.name profile.avatarUrl')
      .sort({ _id: 1 })
      .lean();
    // Format messages để trả về
    return messages.map((msg) => ({
      _id: msg._id,
      readReceipts: msg.readReceipts,
    }));
  }

  async searchMessages(conversationId: string, searchDto: SearchMessagesDto) {
    const {
      userId,
      keyword,
      senderId,
      startDate,
      endDate,
      cursor,
      limit = '20',
    } = searchDto;

    const conversationObjectId = new Types.ObjectId(conversationId);
    const userObjectId = new Types.ObjectId(userId);

    const member = await this.memberModel.findOne({
      userId: userObjectId,
      conversationId: conversationObjectId,
      leftAt: null,
    });

    if (!member) {
      throw new NotFoundException(
        'User is not a participant in this conversation',
      );
    }

    const query: Record<string, any> = {
      conversationId: conversationObjectId,
      deletedFor: { $ne: userObjectId },
      recalled: false,
    };

    if (keyword) {
      query.$or = [
        { 'content.text': { $regex: keyword, $options: 'i' } },
        { 'content.files.fileName': { $regex: keyword, $options: 'i' } },
      ];
    }

    if (senderId) {
      query.senderId = new Types.ObjectId(senderId);
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        query.createdAt.$lte = end;
      }
    }

    if (cursor) {
      query._id = { $lt: new Types.ObjectId(cursor) };
    }

    const messages = await this.messageModel
      .find(query)
      .sort({ _id: -1 })
      .limit(Number(limit))
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
      .lean<MessageResponse[]>();

    const enrichedMessages = await this.enrichPollMessages(messages);

    const transformedMessages = enrichedMessages.map((message) =>
      this.transformService.transformMessage(message),
    );
    return {
      messages: transformedMessages,
      nextCursor:
        transformedMessages.length > 0
          ? transformedMessages[transformedMessages.length - 1]._id
          : null,
    };
  }

  async getPollStatistics(pollId: string, bypassCache = false) {
    const cacheKey = `poll:stats:${pollId}`;
    if (!bypassCache) {
      try {
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (err) {
        console.error('Failed to get poll stats cache from Redis:', err);
      }
    }

    const pollObjectId = new Types.ObjectId(pollId);

    const stats = await this.pollModel.aggregate([
      { $match: { _id: pollObjectId } },
      // 1. Join với pollvotes để lấy các chỉ số tổng quát
      {
        $lookup: {
          from: 'pollvotes',
          localField: '_id',
          foreignField: 'pollId',
          as: 'allVotes',
        },
      },
      {
        $addFields: {
          totalParticipants: {
            $size: { $setUnion: '$allVotes.userId' },
          },
        },
      },
      // 2. Xử lý từng option để lấy voteCount và Top 5 voters
      { $unwind: '$options' },
      {
        $lookup: {
          from: 'pollvotes',
          let: { pId: '$_id', oId: '$options._id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$pollId', '$$pId'] },
                    { $eq: ['$optionId', '$$oId'] },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            {
              $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'userInfo',
              },
            },
            { $unwind: '$userInfo' },
            {
              $project: {
                _id: 0,
                userId: 1,
                name: '$userInfo.profile.name',
                avatar: '$userInfo.profile.avatarUrl',
              },
            },
          ],
          as: 'voters',
        },
      },
      {
        $addFields: {
          'options.voters': {
            $map: {
              input: '$voters',
              as: 'v',
              in: {
                userId: '$$v.userId',
                name: '$$v.name',
                avatar: '$$v.avatar',
              },
            },
          },
          'options.voteCount': {
            $size: {
              $filter: {
                input: '$allVotes',
                as: 'av',
                cond: { $eq: ['$$av.optionId', '$options._id'] },
              },
            },
          },
        },
      },
      // 3. Group lại thành document Poll hoàn chỉnh
      {
        $group: {
          _id: '$_id',
          title: { $first: '$title' },
          isMultipleChoice: { $first: '$isMultipleChoice' },
          allowAddOptions: { $first: '$allowAddOptions' },
          isAnonymous: { $first: '$isAnonymous' },
          hideResultsUntilVoted: { $first: '$hideResultsUntilVoted' },
          expiresAt: { $first: '$expiresAt' },
          totalParticipants: { $first: '$totalParticipants' },
          options: { $push: '$options' },
          createdAt: { $first: '$createdAt' },
        },
      },
    ]);

    const result = stats[0] || null;

    if (result) {
      try {
        await this.redisService.set(cacheKey, JSON.stringify(result), 'EX', 86400);
      } catch (err) {
        console.error('Failed to set poll stats cache in Redis:', err);
      }
    }

    return result;
  }

  async getPollMessagesFromConversation(
    conversationId: string,
    userId: string,
  ) {
    const conversationObjectId = new Types.ObjectId(conversationId);
    const userObjectId = new Types.ObjectId(userId);

    // 1. Kiểm tra quyền
    const member = await this.memberModel.exists({
      userId: userObjectId,
      conversationId: conversationObjectId,
      leftAt: null,
    });
    if (!member) throw new ForbiddenException('Bạn không ở trong nhóm này');

    // 2. Query tin nhắn loại POLL
    const messages = await this.messageModel
      .find({
        conversationId: conversationObjectId,
        type: MessageType.POLL,
        deletedFor: { $ne: userObjectId },
        recalled: false,
      })
      .sort({ createdAt: -1 })
      .populate('senderId', 'profile.name profile.avatarUrl')
      .populate('pollId')
      .lean();

    // 3. Transform & Filter
    const enrichedMessages = await this.enrichPollMessages(messages);
    const transformedMessages = enrichedMessages.map((msg) =>
      this.transformService.transformMessage(msg),
    );

    return transformedMessages.filter((msg) => msg.pollId);
  }
}
