import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import { Model } from 'mongoose';
import { Gender } from '@zalo-clone/shared-types';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async findByPhone(phone: string) {
    return this.userModel.findOne({ phone: phone }).exec();
  }

  async createRegister(
    phone: string,
    name: string,
    gender: Gender,
    birthday: Date,
    password: string,
  ) {
    const profile = {
      name,
      gender,
      birthday,
    };
    try {
      // Tạo user với phone và profile
      return await this.userModel.create({
        phone,
        profile,
        password,
        settings: {
          allowMessagesFromStrangers: true,
          allowCallFromStrangers: true,
        },
      });
    } catch (err) {
      console.log(`Lỗi tạo người dùng mới ${err as string}`);
      throw new InternalServerErrorException(
        'Lỗi hệ thống khi tạo người dùng mới !',
      );
    }
  }

  createTestUser(body: any) {
    return this.userModel.create(body);
  }
}
