import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { FriendStatus, Gender } from '@zalo-clone/shared-types';
import { Types } from 'mongoose';

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

  @Prop()
  refreshToken?: string;

  @Prop()
  lastSeenAt?: Date;

  @Prop({ type: [Friend], default: [] })
  friends?: Friend[];
}

export const UserSchema = SchemaFactory.createForClass(User);
