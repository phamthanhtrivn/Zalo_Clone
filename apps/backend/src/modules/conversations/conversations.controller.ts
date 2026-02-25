import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { TransferOwnerDto } from './dto/transfer-owenr.dto';
import { RemoveMemberDto } from './dto/remove-member.dto';
import { AddMemberDto } from './dto/add-member.dto';

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

  @Patch(':id/members/role')
  async updateMembersRole(
    @Param('id') id: string,
    @Req() req,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    const userId = req.user?.id;
    return this.conversationsService.updateMembersRole(id, userId, dto);
  }

  @Post(':id/transfer-owner')
  async transferOwner(
    @Param('id') id: string,
    @Req() req,
    @Body() dto: TransferOwnerDto,
  ) {
    const currentOwnerId = req.user?.id;
    return this.conversationsService.transferOwner(id, currentOwnerId, dto);
  }

  @Delete(':id/remove-member')
  async removeMember(
    @Param('id') id: string,
    @Req() req,
    @Body() dto: RemoveMemberDto,
  ) {
    const actorId = req.user?.id;

    return this.conversationsService.removeMember(id, actorId, dto);
  }

  @Post(':id/add-members')
  async addMembers(
    @Param('id') id: string,
    @Req() req,
    @Body() dto: AddMemberDto,
  ) {
    const actorId = req.user?.id;
    return this.conversationsService.addMember(id, actorId, dto);
  }
}
