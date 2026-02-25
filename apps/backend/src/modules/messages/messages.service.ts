/* eslint-disable @typescript-eslint/no-unsafe-call */
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
import { ConversationType, MemberRole } from '@zalo-clone/shared-types';
import { PinnedMessageDto } from './dto/pinned-message.dto';
import { RecalledMessageDto } from './dto/recalled-message.dto';
import { ReactionDto } from './dto/reaction.dto';
import { RemoveReactionDto } from './dto/remove-reaction.dto';
import { ReadReceiptDto } from './dto/read-reciept.dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<Message>,
    @InjectModel(Member.name)
    private readonly memberModel: Model<Member>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<Conversation>,
  ) {}

  async sendMessage(sendMessageDto: SendMessageDto) {
    const { senderId, conversationId, content, call, repliedId } =
      sendMessageDto;

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

    if ((!content && !call) || (content && call)) {
      throw new BadRequestException('Content or call must be provided');
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
      const { text, icon, file } = content;

      if (!text && !icon && !file) {
        throw new BadRequestException(
          'At least one of text, icon, or file must be provided in content',
        );
      }

      formattedContent = {
        text: text ?? null,
        icon: icon ?? null,
        file: file ?? null,
      };
    }

    const message = await this.messageModel.create({
      senderId: new Types.ObjectId(senderId),
      conversationId: new Types.ObjectId(conversationId),
      content: formattedContent,
      call: call ?? null,
      pinned: false,
      recalled: false,
      reactions: [],
      readReceipts: [],
      repliedId: repliedId ? new Types.ObjectId(repliedId) : null,
    });

    await this.conversationModel.findByIdAndUpdate(conversationId, {
      lastMessageId: new Types.ObjectId(message._id),
      lastMessageAt: (message as any).createdAt,
    });

    return message;
  }

  async pinnedMessage(pinnedMessageDto: PinnedMessageDto) {
    const { userId, messageId, conversationId } = pinnedMessageDto;

    const message = await this.messageModel.findById(messageId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.call) {
      throw new BadRequestException('Cannot pinned a call message');
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

    if (message.conversationId.toString() !== conversationId) {
      throw new BadRequestException(
        'Message does not belong to this conversation',
      );
    }

    const conversation = await this.conversationModel.findById(conversationId);
    if (conversation!.type === ConversationType.GROUP) {
      if (member.role === MemberRole.MEMBER) {
        throw new BadRequestException(
          'Members are not allowed to pinned messages in group',
        );
      }
    }

    if (message.recalled) {
      throw new BadRequestException('Cannot pinned a recalled message');
    }

    const pinnedCount = await this.messageModel.countDocuments({
      conversationId: new Types.ObjectId(conversationId),
      pinned: true,
    });

    if (!message.pinned && pinnedCount > 3) {
      throw new BadRequestException('Maximum pinned messages reached');
    }

    message.pinned = !message.pinned;
    await message.save();

    return message;
  }

  async recalledMessage(recalledMessageDto: RecalledMessageDto) {
    const { userId, messageId, conversationId } = recalledMessageDto;

    const message = await this.messageModel.findById(messageId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.call) {
      throw new BadRequestException('Cannot recall a call message');
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

    if (message.conversationId.toString() !== conversationId) {
      throw new BadRequestException(
        'Message does not belong to this conversation',
      );
    }

    if (message.senderId.toString() !== userId) {
      throw new BadRequestException('User is not the sender of this message');
    }

    if (message.recalled) {
      throw new BadRequestException('Message has already been recalled');
    }

    const isExpired =
      Date.now() - (message as any).createdAt.getTime() > 24 * 60 * 60 * 1000;

    if (isExpired) {
      throw new BadRequestException(
        'Message is expired and cannot be recalled',
      );
    }

    message.recalled = true;
    await message.save();

    return message;
  }

  async reactionMessage(reactionDto: ReactionDto) {
    const { userId, messageId, conversationId, emojiType } = reactionDto;

    const message = await this.messageModel.findById(messageId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.recalled) {
      throw new BadRequestException('Cannot react to a recalled message');
    }

    if (message.call) {
      throw new BadRequestException('Cannot react to a call message');
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

    if (message.conversationId.toString() !== conversationId) {
      throw new BadRequestException(
        'Message does not belong to this conversation',
      );
    }

    const existingReaction = message.reactions?.find(
      (r) => r.userId.toString() === userId,
    );

    if (!existingReaction) {
      message.reactions?.push({
        userId: new Types.ObjectId(userId),
        emoji: [
          {
            name: emojiType,
            quantity: 1,
          },
        ],
      });
    } else {
      const existingEmoji = existingReaction.emoji.find(
        (e) => e.name === emojiType,
      );

      if (!existingEmoji) {
        existingReaction.emoji.push({
          name: emojiType,
          quantity: 1,
        });
      } else {
        existingEmoji.quantity += 1;
      }
    }

    await message.save();

    return message;
  }

  async removeReactionMessage(removeReactionDto: RemoveReactionDto) {
    const { userId, messageId, conversationId } = removeReactionDto;

    const message = await this.messageModel
      .findOne({
        _id: new Types.ObjectId(messageId),
        conversationId: new Types.ObjectId(conversationId),
      })
      .select('recalled call reactions');

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.recalled) {
      throw new BadRequestException(
        'Cannot remove reaction to a recalled message',
      );
    }

    if (message.call) {
      throw new BadRequestException('Cannot remove reaction to a call message');
    }

    const member = await this.memberModel.exists({
      userId: new Types.ObjectId(userId),
      conversationId: new Types.ObjectId(conversationId),
      leftAt: null,
    });

    if (!member) {
      throw new NotFoundException(
        'User is not a participant in this conversation',
      );
    }

    const updated = await this.messageModel.updateOne(
      {
        _id: new Types.ObjectId(messageId),
        'reactions.userId': new Types.ObjectId(userId),
      },
      {
        $pull: {
          reactions: { userId: new Types.ObjectId(userId) },
        },
      },
    );

    if (updated.modifiedCount === 0) {
      throw new BadRequestException('User has not reacted to this message');
    }

    return updated;
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
