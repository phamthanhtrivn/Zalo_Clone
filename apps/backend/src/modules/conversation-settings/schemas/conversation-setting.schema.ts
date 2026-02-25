import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true })
export class ConversationSetting {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  @Prop({ default: false })
  muted: boolean;

  @Prop({ default: false })
  pinned: boolean;

  @Prop({ default: false })
  hidden: boolean;
}

export type ConversationSettingDocument = ConversationSetting & Document;
export const ConversationSettingSchema =
  SchemaFactory.createForClass(ConversationSetting);

ConversationSettingSchema.index(
  { userId: 1, conversationId: 1 },
  { unique: true },
);

ConversationSettingSchema.index({ userId: 1, pinned: 1 });
