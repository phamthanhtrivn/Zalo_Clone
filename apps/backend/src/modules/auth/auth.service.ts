import { UsersService } from './../users/users.service';
import { RedisService } from './../../common/redis/redis.service';
import {
  BadRequestException,
  Body,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { TokenService } from './jwt.service';
import { Gender } from '@zalo-clone/shared-types';

@Injectable()
export class AuthService {
  constructor(
    private redisService: RedisService,
    private userService: UsersService,
    private tokenService: TokenService,
  ) {}

  //tạo key để lưu otp trong redis
  private otpKey(phone: string) {
    return `otp:${phone}`;
  }

  private resendKey(phone: string) {
    return `otp:resend:${phone}`;
  }

  //send otp
  async sendOtp(phone: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const canResend = await this.redisService.ttl(this.resendKey(phone));

    if (canResend > 0) {
      throw new BadRequestException(
        `Vui lòng đợi ${canResend} giây để gửi lại OTP`,
      );
    }

    // Giả lập gửi otp
    console.log(`Otp for ${phone} is ${otp}`);

    //lưu otp
    await this.redisService.set(
      this.otpKey(phone),
      otp,
      'EX',
      Number(process.env.OTP_EXPIRE_SECONDS),
    );

    //lưu vết để tính thời gian cho phép gửi lại otp
    await this.redisService.set(
      this.resendKey(phone),
      '1',
      'EX',
      Number(process.env.OTP_RESEND_SECONDS),
    );

    return { message: 'Gửi otp thành công!' };
  }

  async verifyOtp(phone: string, otp: string) {
    const savedOtp = await this.redisService.get(this.otpKey(phone));

    if (!savedOtp) {
      throw new BadRequestException('OTP đã hết hạn !');
    }

    if (otp !== savedOtp) {
      throw new BadRequestException('Nhập sai mã OTP !');
    }

    await this.redisService.del(this.otpKey(phone));

    const user = await this.userService.findByPhone(phone);

    if (user) {
      // const accessToken = this.tokenService.signAccess({
      //   userId: String(user.id),
      //   phone: user.phone,
      // });
      // return accessToken;
      ////------- CÒN CHỈNH SỬA
    } else {
      return this.tokenService.signTempVerify({
        phone: phone,
        purpose: 'profile_completion',
      });
    }
  }

  async signUp(
    phone: string,
    name: string,
    gender: Gender,
    birthday: Date,
    password: string,
  ) {
    try {
      return await this.userService.createRegister(
        phone,
        name,
        gender,
        birthday,
        password,
      );
    } catch (err) {
      console.log(`Lỗi tạo user: ${err as string}`);
      throw new InternalServerErrorException('Lỗi đăng ký!');
    }
  }
}
