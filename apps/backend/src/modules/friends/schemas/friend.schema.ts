import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { FriendStatus } from '@zalo-clone/shared-types';
import { Types } from 'mongoose';

@Schema({ timestamps: true })
export class Friend {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  friendId: Types.ObjectId;

  @Prop({ type: String, enum: FriendStatus, required: true })
  status: FriendStatus;
}

export const FriendSchema = SchemaFactory.createForClass(Friend);

FriendSchema.index({ userId: 1, friendId: 1 }, { unique: true });
FriendSchema.index({ userId: 1, status: 1 });
