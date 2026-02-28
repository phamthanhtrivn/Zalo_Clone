import { AuthService } from './auth.service';
import {
  Body,
  Controller,
  InternalServerErrorException,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { SignUpDto } from './dto/signUp.dto';
import { TempVerifyGuard } from './passport/temp-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { Public } from 'src/common/decorator/is-public.decorator';
import { RequestOtpDTO } from './dto/request-otp.dto';
import { AuthUser } from './auth.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sign-up')
  @Public()
  async signUp(@Body() requestOtp: RequestOtpDTO) {
    return this.authService.signUp(requestOtp.phone);
  }

  @Post('otp/verify')
  @Public()
  verifyOtp(@Body() verifyOtp: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtp.phone, verifyOtp.otp);
  }

  @Post('complete-sign-up')
  @Public()
  @UseGuards(TempVerifyGuard)
  async completeSignUp(@Body() signUpDto: SignUpDto) {
    console.log('Request user:', signUpDto);
    try {
      return await this.authService.completeSignUp(
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

  @Post('sign-in')
  @Public()
  @UseGuards(LocalAuthGuard)
  logIn(@Request() req: { user: AuthUser }) {
    return this.authService.signIn(req.user);
  }
}
