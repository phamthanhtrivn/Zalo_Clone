/* eslint-disable prettier/prettier */

import { Body, Controller, Patch } from '@nestjs/common';
import { ConversationSettingsService } from './conversation-settings.service';
import { Types } from 'mongoose';
@Controller('conversation-settings')
export class ConversationSettingsController {
    constructor(
        private readonly conversationSettingsService: ConversationSettingsService,
    ) { }

    // Ẩn
    @Patch('hide')
    hideConversation(
        @Body('userId') userId: string,
        @Body('conversationId') conversationId: string,
    ) {
        return this.conversationSettingsService.hideConversation(new Types.ObjectId(userId),
            new Types.ObjectId(conversationId));

    }
    // Bỏ ẩn
    @Patch('unhide')
    unhideConversation(
        @Body('userId') userId: string,
        @Body('conversationId') conversationId: string,
    ) {
        return this.conversationSettingsService.unhideConversation(
            new Types.ObjectId(userId),
            new Types.ObjectId(conversationId));

    }
    // Gim
    @Patch('pin')
    pinConversation(
        @Body('userId') userId: string,
        @Body('conversationId') conversationId: string,
    ) {
        return this.conversationSettingsService.pinConversation(new Types.ObjectId(userId),
            new Types.ObjectId(conversationId));

    }
    // Bỏ Gim
    @Patch('unpin')
    unpinConversation(
        @Body('userId') userId: string,
        @Body('conversationId') conversationId: string,
    ) {
        return this.conversationSettingsService.unpinConversation(
            new Types.ObjectId(userId),
            new Types.ObjectId(conversationId));

    }
    // Tắt thông báo
    @Patch('mute')
    muteConversation(
        @Body('userId') userId: string,
        @Body('conversationId') conversationId: string,
    ) {
        return this.conversationSettingsService.muteConversation(
            new Types.ObjectId(userId),
            new Types.ObjectId(conversationId));
    }

}
