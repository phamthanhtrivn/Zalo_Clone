import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message } from './schemas/message.schema';
import { SendMessageDto } from './dto/send-message.dto';
import { Member } from '../members/schemas/member.schema';
import { Conversation } from '../conversations/schemas/conversation.schema';
import {
  CallStatus,
  ConversationType,
  MemberRole,
} from '@zalo-clone/shared-types';
import { PinnedMessageDto } from './dto/pinned-message.dto';
import { RecalledMessageDto } from './dto/recalled-message.dto';
import { ReactionDto } from './dto/reaction.dto';
import { RemoveReactionDto } from './dto/remove-reaction.dto';
import { ReadReceiptDto } from './dto/read-reciept.dto';
import { StorageService } from 'src/common/storage/storage.service';
import { CallMessageDto } from './dto/call-message.dto';
import { UpdateCallMessageDto } from './dto/update-call-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<Message>,
    @InjectModel(Member.name)
    private readonly memberModel: Model<Member>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<Conversation>,
    private readonly storageService: StorageService,
  ) {}

  async sendMessage(
    sendMessageDto: SendMessageDto,
    file?: Express.Multer.File,
  ) {
    const { senderId, conversationId, content, repliedId } = sendMessageDto;

    const conversation = await this.conversationModel.findById(conversationId);

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
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

    if (!content) {
      throw new BadRequestException('Content must be provided');
    }

    if (conversation.type === ConversationType.GROUP) {
      if (
        member.role === MemberRole.MEMBER &&
        !conversation.group?.allowMembersSendMessages
      ) {
        throw new BadRequestException(
          'Members are not allowed to send messages in this group',
        );
      }
    }

    let formattedContent = {};

    if (content) {
      const { text, icon } = content;

      if (!text && !icon) {
        throw new BadRequestException(
          'At least one of text, icon must be provided in content',
        );
      }

      let uploadedFile = {};

      if (file) {
        uploadedFile = await this.storageService.uploadFile(file);
      }

      formattedContent = {
        text: text ?? null,
        icon: icon ?? null,
        file: uploadedFile ?? null,
      };
    }

    const message = await this.messageModel.create({
      senderId: new Types.ObjectId(senderId),
      conversationId: new Types.ObjectId(conversationId),
      content: formattedContent,
      call: null,
      pinned: false,
      recalled: false,
      reactions: [],
      readReceipts: [
        {
          userId: new Types.ObjectId(senderId),
        },
      ],
      repliedId: repliedId ? new Types.ObjectId(repliedId) : null,
    });

    await this.conversationModel.findByIdAndUpdate(conversationId, {
      lastMessageId: new Types.ObjectId(message._id),
      lastMessageAt: (message as any).createdAt,
    });

    return message;
  }

  async createCallMessage(callMessageDto: CallMessageDto) {
    const { senderId, conversationId } = callMessageDto;

    const objectSenderId = new Types.ObjectId(senderId);
    const objectConversationId = new Types.ObjectId(conversationId);

    const member = await this.memberModel.findOne({
      userId: objectSenderId,
      conversationId: objectConversationId,
      leftAt: null,
    });

    if (!member) {
      throw new NotFoundException(
        'User is not a participant in this conversation',
      );
    }

    const message = await this.messageModel.create({
      senderId: new Types.ObjectId(senderId),
      conversationId: new Types.ObjectId(conversationId),
      content: null,
      call: {
        type: callMessageDto.type,
        status: CallStatus.INITIATED,
        startedAt: null,
        endedAt: null,
        duration: null,
      },
      pinned: false,
      recalled: false,
      reactions: [],
      readReceipts: [
        {
          userId: new Types.ObjectId(senderId),
        },
      ],
      repliedId: null,
    });

    return message;
  }

  async updateCallMessage(updateCallMessageDto: UpdateCallMessageDto) {
    const { messageId, status } = updateCallMessageDto;

    const objectMessageId = new Types.ObjectId(messageId);

    if (status === CallStatus.RINGING) {
      const updated = await this.messageModel.findOneAndUpdate(
        {
          _id: objectMessageId,
          'call.status': CallStatus.INITIATED,
        },
        {
          $set: {
            'call.status': CallStatus.RINGING,
            'call.duration': 0,
          },
        },
        { new: true },
      );

      if (!updated) {
        throw new BadRequestException(
          'Call message not found or not in INITIATED status',
        );
      }

      return updated;
    } else if (status === CallStatus.MISSED) {
      const updated = await this.messageModel.updateOne(
        {
          _id: objectMessageId,
          'call.status': { $in: [CallStatus.INITIATED, CallStatus.RINGING] },
        },
        {
          $set: {
            'call.status': CallStatus.MISSED,
            'call.startedAt': null,
            'call.endedAt': null,
            'call.duration': 0,
          },
        },
      );

      if (updated.modifiedCount === 0) {
        throw new BadRequestException(
          'Call message not found or not in INITIATED or RINGING status',
        );
      }

      return updated;
    } else if (status === CallStatus.REJECTED) {
      const updated = await this.messageModel.updateOne(
        {
          _id: objectMessageId,
          'call.status': CallStatus.RINGING,
        },
        {
          $set: {
            'call.status': CallStatus.MISSED,
            'call.startedAt': null,
            'call.endedAt': null,
            'call.duration': 0,
          },
        },
      );

      if (updated.modifiedCount === 0) {
        throw new BadRequestException(
          'Call message not found or not in RINGING status',
        );
      }

      return updated;
    } else if (status === CallStatus.BUSY) {
      const updated = await this.messageModel.updateOne(
        {
          _id: objectMessageId,
          'call.status': CallStatus.RINGING,
        },
        {
          $set: {
            'call.status': CallStatus.BUSY,
            'call.startedAt': null,
            'call.endedAt': null,
            'call.duration': 0,
          },
        },
      );

      if (updated.modifiedCount === 0) {
        throw new BadRequestException(
          'Call message not found or not in RINGING status',
        );
      }

      return updated;
    } else if (status === CallStatus.ACCEPTED) {
      const updated = await this.messageModel.updateOne(
        {
          _id: objectMessageId,
          'call.status': CallStatus.RINGING,
        },
        {
          $set: {
            'call.status': CallStatus.ACCEPTED,
            'call.startedAt': new Date(),
          },
        },
      );

      if (updated.modifiedCount === 0) {
        throw new BadRequestException(
          'Call message not found or not in RINGING status',
        );
      }

      return updated;
    } else if (status === CallStatus.ENDED) {
      const message = await this.messageModel.findOne({
        _id: objectMessageId,
        'call.status': CallStatus.ACCEPTED,
      });

      if (!message) {
        throw new BadRequestException(
          'Call message not found or not in ACCEPTED status',
        );
      }

      if (!message.call?.startedAt) {
        throw new BadRequestException('Call has no start time');
      }

      const now = new Date();
      const duration =
        (now.getTime() - message.call.startedAt.getTime()) / 1000;

      const updated = await this.messageModel.updateOne(
        { _id: objectMessageId },
        {
          $set: {
            'call.status': CallStatus.ENDED,
            'call.endedAt': now,
            'call.duration': Math.floor(duration),
          },
        },
      );

      return updated;
    }
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

      if (!message) {
        throw new NotFoundException('Message not found');
      }

      if (message.conversationId.toString() !== conversationId) {
        throw new BadRequestException(
          'Message does not belong to this conversation',
        );
      }

      if (message.call) {
        throw new BadRequestException('Cannot pin a call message');
      }

      if (message.recalled) {
        throw new BadRequestException('Cannot pin a recalled message');
      }

      const conversation = await this.conversationModel
        .findById(objectConversationId)
        .session(session);

      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

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

        if (pinnedCount >= 4) {
          throw new BadRequestException('Maximum pinned messages reached');
        }
      }

      message.pinned = !message.pinned;
      await message.save({ session });

      await session.commitTransaction();
      session.endSession();

      return message;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async recalledMessage(recalledMessageDto: RecalledMessageDto) {
    const { userId, messageId, conversationId } = recalledMessageDto;

    const objectUserId = new Types.ObjectId(userId);
    const objectMessageId = new Types.ObjectId(messageId);
    const objectConversationId = new Types.ObjectId(conversationId);

    const member = await this.memberModel.exists({
      userId: objectUserId,
      conversationId: objectConversationId,
      leftAt: null,
    });

    if (!member) {
      throw new NotFoundException(
        'User is not a participant in this conversation',
      );
    }

    const expireDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const message = await this.messageModel.findById(objectMessageId);

    if (!message) {
      throw new NotFoundException('Message not found');
    } else {
      if (message.content?.file) {
        await this.storageService.deleteFile(message.content.file.fileKey);
      }
    }

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
        $set: { recalled: true, 'content.file': null },
      },
    );

    if (result.matchedCount === 0) {
      throw new BadRequestException(
        'Message cannot be recalled (not found, expired, already recalled, or not sender)',
      );
    }

    return await this.messageModel.findById(objectMessageId);
  }

  async reactionMessage(reactionDto: ReactionDto) {
    const { userId, messageId, conversationId, emojiType } = reactionDto;

    const objectUserId = new Types.ObjectId(userId);
    const objectMessageId = new Types.ObjectId(messageId);
    const objectConversationId = new Types.ObjectId(conversationId);

    const member = await this.memberModel.exists({
      userId: objectUserId,
      conversationId: objectConversationId,
      leftAt: null,
    });

    if (!member) {
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
        'reactions.userId': objectUserId,
        'reactions.emoji.name': emojiType,
      },
      {
        $inc: {
          'reactions.$[r].emoji.$[e].quantity': 1,
        },
      },
      {
        arrayFilters: [{ 'r.userId': objectUserId }, { 'e.name': emojiType }],
      },
    );

    if (incResult.modifiedCount > 0) {
      return await this.messageModel.findById(objectMessageId);
    }

    const pushEmojiResult = await this.messageModel.updateOne(
      {
        _id: objectMessageId,
        conversationId: objectConversationId,
        recalled: false,
        call: null,
        'reactions.userId': objectUserId,
      },
      {
        $push: {
          'reactions.$.emoji': {
            name: emojiType,
            quantity: 1,
          },
        },
      },
    );

    if (pushEmojiResult.modifiedCount > 0) {
      return await this.messageModel.findById(objectMessageId);
    }

    const pushUserResult = await this.messageModel.updateOne(
      {
        _id: objectMessageId,
        conversationId: objectConversationId,
        recalled: false,
        call: null,
      },
      {
        $push: {
          reactions: {
            userId: objectUserId,
            emoji: [
              {
                name: emojiType,
                quantity: 1,
              },
            ],
          },
        },
      },
    );

    if (pushUserResult.modifiedCount === 0) {
      throw new BadRequestException(
        'Cannot react to this message (not found, recalled, or a call message)',
      );
    }

    return await this.messageModel.findById(objectMessageId);
  }

  async removeReactionMessage(removeReactionDto: RemoveReactionDto) {
    const { userId, messageId, conversationId } = removeReactionDto;

    const objectUserId = new Types.ObjectId(userId);
    const objectMessageId = new Types.ObjectId(messageId);
    const objectConversationId = new Types.ObjectId(conversationId);

    const member = await this.memberModel.exists({
      userId: objectUserId,
      conversationId: objectConversationId,
      leftAt: null,
    });

    if (!member) {
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
      {
        $pull: {
          reactions: { userId: objectUserId },
        },
      },
    );

    if (result.modifiedCount === 0) {
      throw new BadRequestException(
        'Cannot remove reaction from this message (not found, already removed, recalled, or a call message)',
      );
    }

    return await this.messageModel.findById(objectMessageId);
  }

  async readReceiptMessage(readReceiptDto: ReadReceiptDto) {
    const { userId, messageId, conversationId } = readReceiptDto;

    const objectUserId = new Types.ObjectId(userId);
    const objectMessageId = new Types.ObjectId(messageId);
    const objectConversationId = new Types.ObjectId(conversationId);

    const member = await this.memberModel.exists({
      userId: objectUserId,
      conversationId: objectConversationId,
      leftAt: null,
    });

    if (!member) {
      throw new NotFoundException(
        'User is not a participant in this conversation',
      );
    }

    const updated = await this.messageModel.updateOne(
      {
        _id: objectMessageId,
        conversationId: objectConversationId,
        'readReceipts.userId': { $ne: objectUserId },
      },
      {
        $push: {
          readReceipts: {
            userId: objectUserId,
          },
        },
      },
    );

    if (updated.modifiedCount === 0) {
      throw new BadRequestException('Message already read by this user');
    }

    return updated;
  }
}
