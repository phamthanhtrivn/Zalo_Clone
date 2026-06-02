/* eslint-disable prettier/prettier */

import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { ConversationSetting, ConversationSettingDocument } from "./schemas/conversation-setting.schema";
import { ConversationSettingGateway } from "./conversation-setting.gateway";
import { User, UserDocument } from "../users/schemas/user.schema";
import { RedisService } from "src/common/redis/redis.service";
import * as bcrypt from "bcrypt";

@Injectable()
export class ConversationSettingsService {
    constructor(
        @InjectModel(ConversationSetting.name)
        private readonly model: Model<ConversationSettingDocument>,
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
        private readonly gateway: ConversationSettingGateway,
        private readonly redisService: RedisService,
    ) { }
    private async emitFullState(userId: string, conversationId: string, setting: any) {
        try {
            await this.redisService.del(`user:conversations:${userId}`);
        } catch (err) {
            console.error("Failed to delete user conversations cache in settings service:", err);
        }

        this.gateway.emitConversationUpdated(userId, {
            conversationId,
            pinned: setting.pinned,
            hidden: setting.hidden,
            mutedUntil: setting.mutedUntil,
            category: setting.category,
            expireDuration: setting.expireDuration,
            clearAt: setting.clearAt,
        });
    }

    private normalizePin(pin?: string) {
        const normalized = String(pin ?? "").trim();
        if (!/^\d{4}$/.test(normalized)) {
            throw new BadRequestException("Mã PIN phải gồm đúng 4 chữ số");
        }
        return normalized;
    }

    private async verifyOrInitializeConversationPin(userId: Types.ObjectId, pin?: string) {
        const normalizedPin = this.normalizePin(pin);
        const user = await this.userModel.findById(userId).select("conversationPinHash");
        if (!user) {
            throw new BadRequestException("Không tìm thấy người dùng");
        }

        if (!user.conversationPinHash) {
            user.conversationPinHash = await bcrypt.hash(normalizedPin, 10);
            await user.save();
            return { pinCreated: true };
        }

        const isMatch = await bcrypt.compare(normalizedPin, user.conversationPinHash);
        if (!isMatch) {
            throw new BadRequestException("Mã PIN không chính xác");
        }

        return { pinCreated: false };
    }

    async pinConversation(userId: Types.ObjectId, conversationId: Types.ObjectId) {
        const setting = await this.model.findOneAndUpdate(
            { userId, conversationId },
            { $set: { pinned: true } },
            { new: true, upsert: true },
        );

        await this.emitFullState(userId.toString(), conversationId.toString(), setting);
        return setting;
    }

    async unpinConversation(userId: Types.ObjectId, conversationId: Types.ObjectId) {
        const setting = await this.model.findOneAndUpdate(
            { userId, conversationId },
            { $set: { pinned: false } },
            { new: true },
        );

        if (!setting) throw new BadRequestException("Not found");

        await this.emitFullState(userId.toString(), conversationId.toString(), setting);
        return setting;
    }

    async hideConversation(userId: Types.ObjectId, conversationId: Types.ObjectId, pin?: string) {
        const { pinCreated } = await this.verifyOrInitializeConversationPin(userId, pin);
        const setting = await this.model.findOneAndUpdate(
            { userId, conversationId },
            { $set: { hidden: true } },
            { new: true, upsert: true },
        );

        await this.emitFullState(userId.toString(), conversationId.toString(), setting);
        return { success: true, pinCreated, setting };
    }

    async unhideConversation(userId: Types.ObjectId, conversationId: Types.ObjectId, pin?: string) {
        const { pinCreated } = await this.verifyOrInitializeConversationPin(userId, pin);
        const setting = await this.model.findOneAndUpdate(
            { userId, conversationId },
            { $set: { hidden: false } },
            { new: true },
        );

        if (!setting) throw new BadRequestException("Not found");

        await this.emitFullState(userId.toString(), conversationId.toString(), setting);
        return { success: true, pinCreated, setting };
    }

    async muteConversation(userId: Types.ObjectId, conversationId: Types.ObjectId, duration: number) {
        if (duration == null) throw new BadRequestException("Duration required");

        let mutedUntil: Date;

        const now = new Date();

        if (duration === -1) {
            mutedUntil = new Date("2999-12-31");
        } else if (duration === -2) {
            const target = new Date();
            target.setHours(8, 0, 0, 0);
            if (now >= target) target.setDate(target.getDate() + 1);
            mutedUntil = target;
        } else {
            mutedUntil = new Date(Date.now() + duration * 60 * 1000);
        }

        const setting = await this.model.findOneAndUpdate(
            { userId, conversationId },
            { $set: { mutedUntil } },
            { new: true, upsert: true },
        );

        await this.emitFullState(userId.toString(), conversationId.toString(), setting);
        return setting;
    }

    async unmuteConversation(userId: Types.ObjectId, conversationId: Types.ObjectId) {
        const setting = await this.model.findOneAndUpdate(
            { userId, conversationId },
            { $set: { mutedUntil: null } },
            { new: true },
        );

        if (!setting) throw new BadRequestException("Not found");

        await this.emitFullState(userId.toString(), conversationId.toString(), setting);
        return setting;
    }

    async setCategory(userId: Types.ObjectId, conversationId: Types.ObjectId, category: string | null) {
        const valid = ["customer", "family", "work", "friends", "later", "colleague"];

        if (category !== null && !valid.includes(category)) {
            throw new BadRequestException("Invalid category");
        }

        const setting = await this.model.findOneAndUpdate(
            { userId, conversationId },
            { $set: { category } },
            { new: true, upsert: true },
        );

        await this.emitFullState(userId.toString(), conversationId.toString(), setting);
        return setting;
    }

    async deleteConversation(userId: Types.ObjectId, conversationId: Types.ObjectId) {
        const setting = await this.model.findOneAndUpdate(
            { userId, conversationId },
            { $set: { deletedAt: new Date(), clearAt: new Date() } },
            { new: true, upsert: true },
        );

        try {
            await this.redisService.del(`user:conversations:${userId.toString()}`);
        } catch (err) {
            console.error("Failed to delete user conversations cache in settings service:", err);
        }

        this.gateway.emitConversationDeleted(userId.toString(), {
            conversationId: conversationId.toString(),
            deletedAt: setting.deletedAt,

            clearAt: setting.clearAt,
        });

        return { success: true };
    }

    async clearConversation(userId: Types.ObjectId, conversationId: Types.ObjectId) {
        const setting = await this.model.findOneAndUpdate(
            { userId, conversationId },
            { $set: { clearAt: new Date() } },
            { new: true, upsert: true },
        );

        await this.emitFullState(userId.toString(), conversationId.toString(), setting);
        this.gateway.emitConversationCleared(userId.toString(), {
            conversationId: conversationId.toString(),
            clearAt: setting.clearAt,
        });

        return { success: true, clearAt: setting.clearAt };
    }

    async setExpire(userId: string, conversationId: string, duration: number) {
        const setting = await this.model.findOneAndUpdate(
            {
                userId: new Types.ObjectId(userId),
                conversationId: new Types.ObjectId(conversationId),
            },
            { $set: { expireDuration: duration } },
            { new: true, upsert: true },
        );

        try {
            await this.redisService.del(`user:conversations:${userId}`);
        } catch (err) {
            console.error("Failed to delete user conversations cache in settings service:", err);
        }

        this.gateway.emitConversationUpdated(userId, {
            conversationId,
            expireDuration: setting.expireDuration,
        });

        return setting;
    }
}
