import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import { Model } from 'mongoose';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async findByPhone(phone: string): Promise<User | null> {
    return this.userModel.findOne({ phone: phone }).exec();
  }

  createTestUser(body: any) {
    return this.userModel.create(body);
  }
}
