import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { CallStatus, CallType, FileType } from '@zalo-clone/shared-types';
import { EmojiType } from '@zalo-clone/shared-types/dist/enums/emoji-type';
import { Types } from 'mongoose';

@Schema({ _id: false })
export class File {
  @Prop()
  fileName: string;

  @Prop()
  fileUrl: string;

  @Prop()
  fileSize: number;

  @Prop({ type: String, enum: FileType })
  type: FileType;
}

@Schema({ _id: false })
export class Content {
  @Prop()
  text?: string;

  @Prop()
  icon?: string;

  @Prop({ type: File })
  file?: File;
}

@Schema({ _id: false })
export class Emoji {
  @Prop({ type: String, enum: EmojiType, required: true })
  name: EmojiType;

  @Prop({ required: true, default: 1 })
  quantity: number;
}

@Schema({ _id: false, timestamps: true })
export class Reaction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: [Emoji], default: [] })
  emoji: Emoji[];
}

@Schema({ _id: false, timestamps: true })
export class ReadReceipt {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;
}

@Schema({ _id: false })
export class Call {
  @Prop({ type: String, enum: CallType, required: true })
  type: CallType;

  @Prop({ type: String, enum: CallStatus, required: true })
  status: CallStatus;

  @Prop()
  startedAt: Date;

  @Prop()
  endedAt: Date;

  @Prop()
  duration: number;
}

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Content })
  content?: Content;

  @Prop({ default: false })
  pinned: boolean;

  @Prop({ default: false })
  recalled: boolean;

  @Prop({ type: [Reaction], default: [] })
  reactions?: Reaction[];

  @Prop({ type: [ReadReceipt], default: [] })
  readReceipts?: ReadReceipt[];

  @Prop({ type: Types.ObjectId, ref: 'Message' })
  repliedId?: Types.ObjectId;

  @Prop({ type: Call })
  call?: Call;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1 });
