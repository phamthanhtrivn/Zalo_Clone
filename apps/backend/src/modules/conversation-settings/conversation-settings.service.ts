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
    // Bổ ẩn
    async unhideConversation(
        userId: Types.ObjectId,
        conversationId: Types.ObjectId) {
        const setting = await this.conversationSettingModel.findOneAndUpdate(
            { userId, conversationId },
            { $set: { hidden: false } },
            { new: true }
        );
        if (!setting) {
            throw new Error('Conversation setting not found');
        }
        return setting;
    }
    // Gim cuộc hội thoại
    async pinConversation(
        userId: Types.ObjectId,
        conversationId: Types.ObjectId) {
        const setting = await this.conversationSettingModel.findOneAndUpdate(
            { userId, conversationId },
            { $set: { pinned: true } },
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true,
            }
        );

        return setting;
    }
    // Bỏ gim
    async unpinConversation(
        userId: Types.ObjectId,
        conversationId: Types.ObjectId) {
        const setting = await this.conversationSettingModel.findOneAndUpdate(
            { userId, conversationId },
            { $set: { pinned: false } },
            { new: true }
        );
        if (!setting) {
            throw new Error('Conversation setting not found');
        }
        return setting;

    }
    // Tắt thông báo
    async muteConversation(
        userId: Types.ObjectId,
        conversationId: Types.ObjectId) {
        const setting = await this.conversationSettingModel.findOneAndUpdate(
            { userId, conversationId },
            { $set: { muted: true } },
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true,
            }
        );

        return setting;

    }
    // Bật thông báo
    async unmuteConversation(
        userId: Types.ObjectId,
        conversationId: Types.ObjectId) {
        const setting = await this.conversationSettingModel.findOneAndUpdate(
            { userId, conversationId },
            { $set: { muted: false } },
            { new: true }
        );
        if (!setting) {
            throw new Error('Conversation setting not found');
        }
        return setting;
    }
}

