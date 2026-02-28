/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { UsersService } from './../users/users.service';
import { RedisService } from './../../common/redis/redis.service';
import {
  BadRequestException,
  Body,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Gender } from '@zalo-clone/shared-types';
import * as bcrypt from 'bcrypt';
import { AuthUser } from './auth.type';
import { TokenService } from './jwt.service';

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

    return true;
  }

  async verifyOtp(phone: string, otp: string) {
    try {
      const savedOtp = await this.redisService.get(this.otpKey(phone));

      if (!savedOtp) {
        throw new BadRequestException('OTP đã hết hạn !');
      }

      if (otp !== savedOtp) {
        throw new BadRequestException('Nhập sai mã OTP !');
      }

      await this.redisService.del(this.otpKey(phone));

      const tmp_token = await this.tokenService.signTempVerify({
        phone,
        type: 'temp_verify',
      });
      return { message: 'Xác thực thành công', tmp_token };
    } catch (err) {
      console.log(`Lỗi xác thực: ${err.message as string}`);
      throw new InternalServerErrorException('Lỗi xác thực OTP !');
    }
  }

  async signUp(phone: string) {
    const user = await this.userService.findByPhone(phone);
    if (user) {
      throw new ConflictException(
        'Số điện thoại đã được đăng ký. Vui lòng đăng nhập !',
      );
    }
    if (await this.sendOtp(phone)) {
      return { message: 'Mã otp đã được gọi. Vui lòng kiểm tra hộp thư !' };
    }
  }

  async completeSignUp(
    phone: string,
    name: string,
    gender: Gender,
    birthday: Date,
    password: string,
  ) {
    try {
      if (
        await this.userService.createRegister(
          phone,
          name,
          gender,
          birthday,
          password,
        )
      )
        return { message: 'Đăng ký tài khoản thành công !' };
    } catch (err) {
      console.log(`Lỗi tạo user: ${err as string}`);
      throw new InternalServerErrorException('Hệ thống lỗi khi đăng ký!');
    }
  }

  async validateUser(phone: string, pass: string): Promise<any> {
    const user = await this.userService.findByPhone(phone);
    if (user && (await bcrypt.compare(pass, user.password))) {
      return { id: user.id, phone: user.phone };
    }
    return null;
  }

  async signIn(user: AuthUser) {
    return { acessToken: await this.tokenService.signAccess(user) };
  }
}
