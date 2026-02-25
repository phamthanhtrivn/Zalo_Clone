import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Conversation,
  ConversationSchema,
} from './schemas/conversation.schema';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import { Message, MessageSchema } from '../messages/schemas/message.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Member.name, schema: MemberSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
  ],
  providers: [ConversationsService],
  controllers: [ConversationsController],
})
export class ConversationsModule {}
