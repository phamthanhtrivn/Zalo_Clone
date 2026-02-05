import { Module } from '@nestjs/common';
import { ConversationSettingsService } from './conversation-settings.service';
import { ConversationSettingsController } from './conversation-settings.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ConversationSetting,
  ConversationSettingSchema,
} from './schemas/conversation-setting.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ConversationSetting.name, schema: ConversationSettingSchema },
    ]),
  ],
  providers: [ConversationSettingsService],
  controllers: [ConversationSettingsController],
})
export class ConversationSettingsModule {}
