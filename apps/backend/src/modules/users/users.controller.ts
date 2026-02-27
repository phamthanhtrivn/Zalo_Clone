import { Body, Controller, Get, Post } from '@nestjs/common';
import { UsersService } from './users.service';

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
}
