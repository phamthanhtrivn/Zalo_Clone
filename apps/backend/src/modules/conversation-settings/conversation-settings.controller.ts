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
}
