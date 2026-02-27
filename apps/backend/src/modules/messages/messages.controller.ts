import {
  Body,
  Controller,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { PinnedMessageDto } from './dto/pinned-message.dto';
import { RecalledMessageDto } from './dto/recalled-message.dto';
import { ReactionDto } from './dto/reaction.dto';
import { RemoveReactionDto } from './dto/remove-reaction.dto';
import { ReadReceiptDto } from './dto/read-reciept.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';

@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  async sendMessage(@Body() sendMessageDto: SendMessageDto) {
    return this.messagesService.sendMessage(sendMessageDto);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    return this.messagesService.uploadFile(file);
  }

  @Patch('pinned')
  async pinnedMessage(@Body() pinnedMessageDto: PinnedMessageDto) {
    return this.messagesService.pinnedMessage(pinnedMessageDto);
  }

  @Patch('recalled')
  async recalledMessage(@Body() recalledMessageDto: RecalledMessageDto) {
    return this.messagesService.recalledMessage(recalledMessageDto);
  }

  @Patch('reaction')
  async reactionMessage(@Body() reactionDto: ReactionDto) {
    return this.messagesService.reactionMessage(reactionDto);
  }

  @Patch('remove-reaction')
  async removeReaction(@Body() removeReactionDto: RemoveReactionDto) {
    return this.messagesService.removeReactionMessage(removeReactionDto);
  }

  @Patch('read-receipt')
  async readReceipt(@Body() readReceiptDto: ReadReceiptDto) {
    return this.messagesService.readReceiptMessage(readReceiptDto);
  }
}
