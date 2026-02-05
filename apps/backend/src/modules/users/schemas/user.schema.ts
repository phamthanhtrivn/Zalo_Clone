import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Gender } from '@zalo-clone/shared-types';

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
}

export const UserSchema = SchemaFactory.createForClass(User);
