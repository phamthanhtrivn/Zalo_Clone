import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Request,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { RequestFriendDto } from './dto/request-friend.dto';
import { RequestFriendPhone } from './dto/request-friend-phone';
import { SearchFriendDto } from './dto/search-friend.dto';
import { InforUser } from './dto/infor-user.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findByPhone(phone: string) {
    return this.usersService.findByPhone(phone);
  }

  @Post('test')
  createTest(@Body() body: any) {
    return this.usersService.createTestUser(body);
  }
  @Post('add-friend')
  addFriend(@Body() body: RequestFriendDto) {
    return this.usersService.addFriend(body);
  }
  @Post('accept-friend')
  acceptFriend(@Body() body: RequestFriendDto) {
    return this.usersService.acceptFriend(body);
  }
  @Post('reject-friend')
  rejectFriend(@Body() body: RequestFriendDto) {
    return this.usersService.rejectFriend(body);
  }
  @Post('block-friend')
  blockFriend(@Body() body: RequestFriendDto) {
    return this.usersService.blockFriend(body);
  }
  // hủy hoặc thu hồi kb
  @Post('cancel-friend')
  cancelFriend(@Body() body: RequestFriendDto) {
    return this.usersService.cancelFriend(body);
  }
  // theo tên người đã kb
  // theo std
  @Post('search-friend')
  searchFriend(@Body() body: SearchFriendDto) {
    return this.usersService.searchFriend(body);
  }
  @Post('search-friend-phone')
  searchFriendPhone(@Body() body: RequestFriendPhone) {
    return this.usersService.searchFriendByPhone(body.userId, body.phone);
  }
  @Patch('update-information-user')
  @UseInterceptors(FileInterceptor('avatar'))
  updateInformationUser(
    @Request() req,
    @Body() body: InforUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.usersService.updateInformationUser(body, file, req.user.userId);
  }
  @Post('suggest-friend')
  suggestFriend(@Request() req) {
    return this.usersService.suggestFriend(req.user.userId);
  }
  @Get('list-friends')
  getListFriends(@Request() req) {
    return this.usersService.getListFriends(req.user.userId);
  }
  @Get('received-friends-requests')
  getReceivedFriendRequests(@Request() req) {
    return this.usersService.getReceivedFriendRequests(req.user.userId);
  }
  @Get('sent-friends-requests')
  getSentFriendRequests(@Request() req) {
    return this.usersService.getSentFriendRequests(req.user.userId);
  }
  @Get('user-information/:userId')
  getUserInformation(@Param('userId') userId: string) {
    return this.usersService.getUserInformation(userId);
  }

  @Get('friend-status/:targetUserId')
  getFriendStatus(@Request() req, @Param('targetUserId') targetUserId: string) {
    return this.usersService.getFriendStatus(req.user.userId, targetUserId);
  }

  @Post('status/bulk')
  getBulkStatus(@Body('userIds') userIds: string[]) {
    return this.usersService.getBulkStatus(userIds);
  }
}
