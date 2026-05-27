import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { FriendStatus } from 'src/common/types/enums/friend-status';
import { Gender } from 'src/common/types/enums/gender';

@Schema({ _id: false })
export class Profile {
  @Prop({ required: true })
  name: string;

  @Prop()
  avatarUrl?: string;

  @Prop({ type: String, enum: Gender })
  gender?: Gender;

  @Prop()
  birthday?: Date;

  @Prop()
  bio?: string;
}

@Schema({ _id: false })
export class Setting {
  @Prop({ default: true })
  allowMessagesFromStrangers: boolean;

  @Prop({ default: true })
  allowCallFromStrangers: boolean;
}

@Schema({ _id: false, timestamps: true })
export class Friend {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  friendId: Types.ObjectId;

  @Prop({ type: String, enum: FriendStatus, required: true })
  status: FriendStatus;
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  phone: string;

  @Prop({ unique: true, sparse: true })
  email?: string;

  @Prop({ required: true })
  password: string;

  @Prop({ type: Profile })
  profile?: Profile;

  @Prop({ type: Setting })
  settings?: Setting;

  @Prop({ default: false })
  isBot!: boolean;

  @Prop()
  lastSeenAt?: Date;

  @Prop({ type: [Friend], default: [] })
  friends?: Friend[];

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  hiddenSocialAuthorIds?: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  blockedDiaryViewerIds?: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  followingVideoCreatorIds?: Types.ObjectId[];

  @Prop()
  conversationPinHash?: string;

  @Prop({ default: false })
  isLocked?: boolean;
}
export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ phone: 1 });
UserSchema.index({ 'profile.name': 1 });
