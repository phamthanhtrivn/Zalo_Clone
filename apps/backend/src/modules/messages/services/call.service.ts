import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Document, Model, Types } from 'mongoose';
import { Message } from '../schemas/message.schema';
import { Member } from '../../members/schemas/member.schema';
import { Conversation } from '../../conversations/schemas/conversation.schema';
import { MessagesTransformService } from './transform.service';
import { CallMessageDto } from '../dto/call-message.dto';
import { UpdateCallMessageDto } from '../dto/update-call-message.dto';
import { CallStatus } from 'src/common/types/enums/call-status';
import { RedisService } from 'src/common/redis/redis.service';
import { REDIS_CHANNEL_SOCKET_EVENTS } from 'src/common/constants/redis.constant';
import { CallSession } from '../schemas/call-session.schema';
import { InitiateGroupCallDto } from '../dto/initiate-group-call.dto';
import { MessageType } from 'src/common/enums/message-type.enum';

interface PopulatedSender {
  _id: Types.ObjectId;
  profile: {
    name: string;
    avatarUrl: string;
  };
}

interface PopulatedMessage extends Document, Omit<Message, 'senderId'> {
  senderId: PopulatedSender;
}

@Injectable()
export class MessagesCallService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<Message>,
    @InjectModel(Member.name)
    private readonly memberModel: Model<Member>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<Conversation>,
    @InjectModel(CallSession.name)
    private readonly callSessionModel: Model<CallSession>,
    private readonly transformService: MessagesTransformService,
    private readonly redisService: RedisService,
  ) { }

  async createCallMessage(callMessageDto: CallMessageDto) {
    const { senderId, conversationId } = callMessageDto;

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

    // Phase 1: Optimize DB Queries - populate directly on created document
    const messageDoc = await this.messageModel.create({
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
      readReceipts: [{ userId: new Types.ObjectId(senderId) }],
      repliedId: null,
    });

    const conversationIdStr = conversationId.toString();
    await this.conversationModel.findByIdAndUpdate(conversationIdStr, {
      lastMessageId: messageDoc._id,
      lastMessageAt: messageDoc.createdAt,
    });

    // Phase 1: Clean Types & Optimize populate (PM note: use populate on doc)
    const populatedMessage = (await messageDoc.populate({
      path: 'senderId',
      select: 'profile.name profile.avatarUrl',
    })) as unknown as PopulatedMessage;

    if (populatedMessage) {
      // PM note: Use toObject() instead of lean()
      const rawMessage = populatedMessage.toObject();
      const signedMessage = {
        ...rawMessage,
        _id: rawMessage._id.toHexString(),
        conversationId: conversationIdStr,
        senderId: this.transformService.signUser(rawMessage.senderId),
      };

      if (signedMessage.senderId && signedMessage.senderId._id) {
        signedMessage.senderId._id = signedMessage.senderId._id.toString();
      }

      // Bắn event cho room hội thoại qua Redis
      await this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
        room: conversationIdStr,
        event: 'new_message',
        data: signedMessage,
      });

      const members = await this.memberModel.find({
        conversationId: new Types.ObjectId(conversationIdStr),
        leftAt: null,
      });

      // Phase 1: Remove Redis Bottleneck - use Promise.all
      await Promise.all(
        members.map((m) =>
          this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
            room: m.userId.toString(),
            event: 'new_message_sidebar',
            data: signedMessage,
          }),
        ),
      );

      await this.invalidateMessagesCache(conversationIdStr);
      await this.invalidateConversationCacheForMembers(conversationIdStr);
    }

    return messageDoc;
  }

  async updateCallMessage(updateCallMessageDto: UpdateCallMessageDto) {
    const result = await this._updateCallMessageDoc(updateCallMessageDto);
    if (result) {
      const convId = updateCallMessageDto.conversationId.toString();
      await this.invalidateMessagesCache(convId);
      await this.invalidateConversationCacheForMembers(convId);
    }
    return result;
  }

  async _updateCallMessageDoc(updateCallMessageDto: UpdateCallMessageDto) {
    const { messageId, conversationId, status } = updateCallMessageDto;
    const objectMessageId = new Types.ObjectId(messageId);

    if (status === CallStatus.RINGING) {
      const updated = await this.messageModel.findOneAndUpdate(
        { _id: objectMessageId, 'call.status': CallStatus.INITIATED },
        { $set: { 'call.status': CallStatus.RINGING, 'call.duration': 0 } },
        { new: true },
      );

      if (!updated) {
        throw new BadRequestException(
          'Call message not found or not in INITIATED status',
        );
      }
      return updated;
    }

    if (status === CallStatus.MISSED) {
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

      await this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
        room: conversationId,
        event: 'call_updated',
        data: { messageId, status: CallStatus.MISSED, conversationId },
      });

      return updated;
    }

    if (status === CallStatus.REJECTED) {
      const updated = await this.messageModel.updateOne(
        { _id: objectMessageId, 'call.status': CallStatus.RINGING },
        {
          $set: {
            'call.status': CallStatus.REJECTED,
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

      await this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
        room: conversationId,
        event: 'call_updated',
        data: { messageId, status: CallStatus.REJECTED, conversationId },
      });

      return updated;
    }

    if (status === CallStatus.BUSY) {
      const updated = await this.messageModel.updateOne(
        { _id: objectMessageId, 'call.status': CallStatus.RINGING },
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

      await this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
        room: conversationId,
        event: 'call_updated',
        data: { messageId, status: CallStatus.BUSY, conversationId },
      });

      return updated;
    }

    if (status === CallStatus.ACCEPTED) {
      const updated = await this.messageModel.updateOne(
        { _id: objectMessageId, 'call.status': CallStatus.RINGING },
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

      await this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
        room: conversationId,
        event: 'call_updated',
        data: { messageId, status: CallStatus.ACCEPTED, conversationId },
      });

      return updated;
    }

    if (status === CallStatus.ENDED) {
      const message = await this.messageModel.findOne({
        _id: objectMessageId,
        'call.status': CallStatus.ACCEPTED,
      });

      if (!message || !message.call?.startedAt) {
        throw new BadRequestException(
          'Call message not found or not in ACCEPTED status, or has no start time',
        );
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

      await this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
        room: conversationId,
        event: 'call_updated',
        data: {
          messageId,
          status: CallStatus.ENDED,
          duration: Math.floor(duration),
          conversationId,
        },
      });

      return updated;
    }

    // Phase 1: Fix Missing Return - catch unhandled status updates
    throw new BadRequestException('Invalid call status transition');
  }

  async initiateGroupCall(dto: InitiateGroupCallDto) {
    const { senderId, conversationId, type } = dto;
    console.log(`[initiateGroupCall] Starting: sender=${senderId}, conv=${conversationId}`);

    try {
      const member = await this.memberModel.findOne({
        userId: new Types.ObjectId(senderId),
        conversationId: new Types.ObjectId(conversationId),
        leftAt: null,
      });

      if (!member) {
        console.warn(`[initiateGroupCall] User ${senderId} not a member of ${conversationId}`);
        throw new NotFoundException('User is not a participant in this conversation');
      }
      console.log(`[initiateGroupCall] Member verified`);

      // ✅ End any existing active sessions for this conversation
      try {
        const existingActive = await this.callSessionModel.find({
          conversationId: new Types.ObjectId(conversationId),
          status: 'ACTIVE'
        });

        for (const session of existingActive) {
          console.log(`[initiateGroupCall] Ending old active session: ${session._id}`);
          await this.callSessionModel.updateOne(
            { _id: session._id },
            {
              $set: {
                status: 'ENDED',
                endedAt: new Date()
              }
            }
          );
          // Manually update participants to avoid positional operator issues
          await this.callSessionModel.updateOne(
            { _id: session._id, "participants.leftAt": null },
            { $set: { "participants.$[].leftAt": new Date() } }
          );

          const oldMsg = await this.messageModel.findOne({ callSessionId: session._id });
          if (oldMsg) {
            await this.messageModel.updateOne({ _id: oldMsg._id }, { $set: { 'call.status': 'ENDED' } });
            await this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
              room: conversationId.toString(),
              event: 'group_call_updated',
              data: {
                sessionId: session._id.toString(),
                status: 'ENDED',
                messageId: oldMsg._id.toString(),
                conversationId: conversationId.toString()
              }
            });
          }
        }
      } catch (err) {
        console.warn(`[initiateGroupCall] Non-critical error during session cleanup:`, err.message);
      }

      console.log(`[initiateGroupCall] Old sessions cleaned`);

      const sessionDoc = await this.callSessionModel.create({
        conversationId: new Types.ObjectId(conversationId),
        hostId: new Types.ObjectId(senderId),
        type,
        status: 'ACTIVE',
        participants: [{
          userId: new Types.ObjectId(senderId),
          joinedAt: new Date(),
          leftAt: null
        }],
        startedAt: new Date(),
      });

      console.log(`[initiateGroupCall] Session created: ${sessionDoc._id}`);

      const messageDoc = await this.messageModel.create({
        senderId: new Types.ObjectId(senderId),
        conversationId: new Types.ObjectId(conversationId),
        type: MessageType.GROUP_CALL,
        content: {
          text: null,
          icon: null,
          files: [],
          voiceDuration: null,
          storyLink: null,
        },
        callSessionId: sessionDoc._id,
        pinned: false,
        recalled: false,
        reactions: [],
        readReceipts: [{ userId: new Types.ObjectId(senderId) }],
      });

      console.log(`[initiateGroupCall] Message created: ${messageDoc._id}`);

      const conversationIdStr = conversationId.toString();
      await this.conversationModel.findByIdAndUpdate(conversationIdStr, {
        lastMessageId: messageDoc._id,
        lastMessageAt: messageDoc.createdAt,
      });

      // Simple population
      const populatedMsg = await this.messageModel.findById(messageDoc._id)
        .populate({
          path: 'senderId',
          select: 'profile.name profile.avatarUrl',
        })
        .populate('readReceipts.userId', 'profile.name profile.avatarUrl');

      if (populatedMsg) {
        console.log(`[initiateGroupCall] Message populated`);
        const rawMessage = (populatedMsg as any).toObject();
        const signedMessage = this.transformService.transformMessage({
          ...rawMessage,
          _id: rawMessage._id.toString(),
          conversationId: conversationIdStr,
        });

        await this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
          room: conversationIdStr,
          event: 'new_message',
          data: signedMessage,
        });

        const members = await this.memberModel.find({
          conversationId: new Types.ObjectId(conversationIdStr),
          leftAt: null,
        });

        await Promise.all(
          members.map((m) =>
            this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
              room: m.userId.toString(),
              event: 'new_message_sidebar',
              data: signedMessage,
            }),
          ),
        );
      }
      console.log(`[initiateGroupCall] Broadcast complete`);
      await this.invalidateMessagesCache(conversationIdStr);
      await this.invalidateConversationCacheForMembers(conversationIdStr);

      return { session: sessionDoc, message: messageDoc };
    } catch (err) {
      console.error(`[initiateGroupCall] Error:`, err);
      throw err;
    }
  }

  async joinGroupCall(userId: string, sessionId: string) {
    const session = await this.callSessionModel.findById(sessionId);
    if (!session || session.status !== 'ACTIVE') {
      throw new BadRequestException('Call session is not active');
    }

    const activeParticipants = session.participants.filter(p => !p.leftAt);
    if (activeParticipants.length >= 5) {
      throw new BadRequestException('Call is full (max 5 participants)');
    }

    const userObjId = new Types.ObjectId(userId);
    const existing = activeParticipants.find(p => p.userId.toString() === userId);

    if (!existing) {
      // Atomic Update
      await this.callSessionModel.updateOne(
        { _id: new Types.ObjectId(sessionId) },
        {
          $push: {
            participants: {
              userId: userObjId,
              joinedAt: new Date(),
              leftAt: null
            }
          }
        }
      );
    }

    const updatedSession = await this.callSessionModel.findById(sessionId);
    if (!updatedSession) {
      throw new BadRequestException('Call session not found after update');
    }
    const existingActiveParticipants = updatedSession.participants
      .filter(p => !p.leftAt && p.userId.toString() !== userId)
      .map(p => p.userId.toString());

    return existingActiveParticipants;
  }

  async leaveGroupCall(userId: string, sessionId: string) {
    const userObjId = new Types.ObjectId(userId);
    const objSessionId = new Types.ObjectId(sessionId);

    // ✅ Skip already-ended sessions
    const session = await this.callSessionModel.findById(objSessionId);
    if (!session) {
      console.log(`[leaveGroupCall] Session ${sessionId} not found, skipping`);
      return;
    }
    if (session.status === 'ENDED') {
      console.log(`[leaveGroupCall] Session ${sessionId} already ENDED, skipping`);
      return;
    }

    // ✅ Mark the participant as left
    const updated = await this.callSessionModel.findOneAndUpdate(
      {
        _id: objSessionId,
        status: { $ne: 'ENDED' },
        participants: {
          $elemMatch: {
            userId: userObjId,
            $or: [{ leftAt: null }, { leftAt: { $exists: false } }]
          }
        }
      },
      {
        $set: { 'participants.$.leftAt': new Date() }
      },
      { new: true }
    );

    // ✅ Use fallback: re-fetch if the user was already marked as left
    const sessionToCheck = updated || session;
    const activeParticipants = sessionToCheck.participants.filter(p => !p.leftAt);
    console.log(`[leaveGroupCall] Session: ${sessionId}, Active count: ${activeParticipants.length}${!updated ? ' (already left, using fallback)' : ''}`);

    if (activeParticipants.length === 0) {
      console.log(`[leaveGroupCall] All left - terminating session: ${sessionId}`);
      await this.callSessionModel.updateOne(
        { _id: objSessionId },
        { $set: { status: 'ENDED', endedAt: new Date() } }
      );

      const message = await this.messageModel.findOne({ callSessionId: objSessionId });
      if (message) {
        console.log(`[leaveGroupCall] Found message: ${message._id}, updating to ENDED`);
        const duration = Math.floor((new Date().getTime() - sessionToCheck.startedAt.getTime()) / 1000);
        await this.messageModel.updateOne(
          { _id: message._id },
          { $set: { 'call.status': 'ENDED', 'call.type': 'VIDEO', 'call.duration': duration } }
        );

        await this.redisService.publish(REDIS_CHANNEL_SOCKET_EVENTS, {
          room: sessionToCheck.conversationId.toString(),
          event: 'group_call_updated',
          data: {
            sessionId,
            status: 'ENDED',
            messageId: message._id.toString(),
            conversationId: sessionToCheck.conversationId.toString(),
            duration
          }
        });

        const convId = sessionToCheck.conversationId.toString();
        await this.invalidateMessagesCache(convId);
        await this.invalidateConversationCacheForMembers(convId);
      }
    } else if (!updated) {
      console.log(`[leaveGroupCall] User ${userId} not found as active in session ${sessionId}`);
    }
  }

  async leaveAllActiveGroupCalls(userId: string) {
    const userObjId = new Types.ObjectId(userId);
    const activeSessions = await this.callSessionModel.find({
      status: 'ACTIVE',
      'participants.userId': userObjId,
      'participants.leftAt': null
    });

    for (const session of activeSessions) {
      await this.leaveGroupCall(userId, session._id.toString());
    }

    return activeSessions.map(s => ({ sessionId: s._id.toString(), conversationId: s.conversationId.toString() }));
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
      console.error('Failed to invalidate messages/media-preview cache in call service:', err);
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
      console.error('Failed to invalidate conversation cache for members in call service:', err);
    }
  }
}
