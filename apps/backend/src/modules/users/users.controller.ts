import { Body, Controller, Get, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './schemas/user.schema';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findByPhone(phone: string): Promise<User | null> {
    return this.usersService.findByPhone(phone);
  }

  @Post('test')
  createTest(@Body() body: any) {
    return this.usersService.createTestUser(body);
  }
}
