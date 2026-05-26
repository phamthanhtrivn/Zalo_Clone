import { forwardRef, Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Conversation,
  ConversationSchema,
  JoinRequest,
  JoinRequestSchema,
} from './schemas/conversation.schema';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import { Message, MessageSchema } from '../messages/schemas/message.schema';
import {
  ConversationSetting,
  ConversationSettingSchema,
} from '../conversation-settings/schemas/conversation-setting.schema';

import { UserSchema } from '../users/schemas/user.schema';

import { StorageModule } from 'src/common/storage/storage.module';
import { ChatModule } from '../chat/chat.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [
    forwardRef(() => ChatModule),
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Member.name, schema: MemberSchema },
      { name: Message.name, schema: MessageSchema },
      { name: ConversationSetting.name, schema: ConversationSettingSchema },
      { name: 'User', schema: UserSchema },
      { name: JoinRequest.name, schema: JoinRequestSchema },
    ]),
    forwardRef(() => MessagesModule),
    StorageModule,
  ],
  providers: [ConversationsService],
  controllers: [ConversationsController],
  exports: [ConversationsService],
})
export class ConversationsModule {}
