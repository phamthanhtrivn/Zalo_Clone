import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ConversationType } from '@zalo-clone/shared-types';
import { Types } from 'mongoose';

@Schema({ _id: false })
export class Group {
  @Prop({ required: true })
  name: string;

  @Prop()
  avatarUrl?: string;

  @Prop({ default: false })
  allowMembersInvite: boolean;

  @Prop({ default: false })
  allowMembersSendMessages: boolean;
}

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ type: String, enum: ConversationType, required: true })
  type: ConversationType;

  @Prop({ type: Group })
  group?: Group;

  @Prop({ type: Types.ObjectId, ref: 'Message', required: true })
  lastMessageId: Types.ObjectId;

  @Prop({ required: true })
  lastMessageAt: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

ConversationSchema.index({ lastMessageAt: -1 });
