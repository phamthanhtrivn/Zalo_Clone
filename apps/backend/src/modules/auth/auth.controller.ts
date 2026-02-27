import { AuthService } from './auth.service';
import {
  Body,
  Controller,
  InternalServerErrorException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { SignUpDto } from './dto/signUp.dto';
import { TempVerifyGuard } from './guards/temp-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('otp/send')
  async sendOtp(@Body('phone') phone: string) {
    return this.authService.sendOtp(phone);
  }

  @Post('otp/verify')
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto.phone, verifyOtpDto.otp);
  }

  @Post('sign-up')
  @UseGuards(TempVerifyGuard)
  async signUp(@Body() signUpDto: SignUpDto) {
    console.log('Request user:', signUpDto);
    try {
      return await this.authService.signUp(
        signUpDto.phone,
        signUpDto.name,
        signUpDto.gender,
        signUpDto.birthDay,
        signUpDto.password,
      );
    } catch (err) {
      console.log(`Lỗi khi sign up: ${err}`);
      throw new InternalServerErrorException('Lỗi sign up');
    }
  }
}
