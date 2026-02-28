import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, MessageSchema } from './schemas/message.schema';
import { MembersModule } from '../members/members.module';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import {
  Conversation,
  ConversationSchema,
} from '../conversations/schemas/conversation.schema';
import { StorageModule } from 'src/common/storage/storage.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Member.name, schema: MemberSchema },
      { name: Conversation.name, schema: ConversationSchema },
    ]),
    MembersModule,
    StorageModule,
  ],
  providers: [MessagesService],
  controllers: [MessagesController],
})
export class MessagesModule {}
