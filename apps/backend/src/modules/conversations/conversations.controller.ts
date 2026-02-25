import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CreateGroupDto } from './dto/create-group.dto';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post('group')
  //   @UseGuards()
  async createGroup(@Req() req, @Body() createGroupDto: CreateGroupDto) {
    const userId = req.user?._id;

    return this.conversationsService.createGroup(userId, createGroupDto);
  }

  @Delete(':id/delete')
  async deleteGroup(@Param('id') id: string, @Req() req) {
    const userId = req.user?.id;

    return this.conversationsService.deleteGroup(id, userId);
  }
}
