import { Body, Controller, Post } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('test')
  createTest(@Body() body: any) {
    return this.usersService.createTestUser(body);
  }
}
