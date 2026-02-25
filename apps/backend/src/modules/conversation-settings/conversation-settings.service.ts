/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
    ConversationSetting,
    ConversationSettingDocument
} from './schemas/conversation-setting.schema';
import { Model, Types } from 'mongoose';
@Injectable()
export class ConversationSettingsService {
    constructor(
        @InjectModel(ConversationSetting.name)
        private readonly conversationSettingModel: Model<ConversationSettingDocument>,
    ) { }

    // Ẩn cuộc hội thoại
    async hideConversation(
        userId: Types.ObjectId,
        conversationId: Types.ObjectId) {
        const setting = await this.conversationSettingModel.findOneAndUpdate(
            {
                userId,
                conversationId,
            },
            {
                $set: { hidden: true },
            },
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true,
            },
        );
        return setting;
    }

}
