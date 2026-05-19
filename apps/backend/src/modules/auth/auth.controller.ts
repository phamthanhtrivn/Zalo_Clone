import { AuthService } from './services/auth.service';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  InternalServerErrorException,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Purpose, VerifyOtpDto } from './dto/verify-otp.dto';
import { SignUpDto } from './dto/signUp.dto';
import { TempVerifyGuard } from './passport/temp-auth.guard';
import { Public } from 'src/common/decorator/is-public.decorator';
import { RequestOtpDTO } from './dto/request-otp.dto';
import { AuthUser } from './types/auth.type';
import { JwtAuthGuard } from './passport/jwt-auth.guard';
import { LocalAuthGuard } from './passport/local-auth.guard';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDTO } from './dto/change-password.dto';
import type { Response } from 'express';
import { RedisService } from 'src/common/redis/redis.service';
import { SessionService } from './services/session.service';
import { RequireTempPurpose } from './decorator/temp_purpose.decorator';
import { ClientContext } from './decorator/client-info.decorator';
import type { IClientInfo } from './decorator/client-info.decorator';
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private redisService: RedisService,
    private sessionService: SessionService,
  ) { }

  @Post('sign-up')
  @Public()
  async signUp(@Body() requestOtp: RequestOtpDTO) {
    return this.authService.signUp(requestOtp.phone);
  }

  @Post('otp/verify')
  @Public()
  verifyOtp(@Body() verifyOtp: VerifyOtpDto) {
    return this.authService.verifyOtp(
      verifyOtp.phone,
      verifyOtp.otp,
      verifyOtp.purpose,
    );
  }

  @Post('complete-sign-up')
  @Public()
  @RequireTempPurpose(Purpose.SignUp)
  @UseGuards(TempVerifyGuard)
  async completeSignUp(
    @Request() req: any,
    @ClientContext() client: IClientInfo,
    @Body() signUpDto: SignUpDto,
    @Headers('authorization') authHeader: string,
  ) {
    if (signUpDto.password !== signUpDto.repassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp !');
    }
    try {
      const session = await this.authService.completeSignUp(
        req.user.phone,
        signUpDto.name,
        signUpDto.gender,
        signUpDto.birthDay,
        signUpDto.password,
        client,
      );
      await this.redisService.del(
        `tmp_token_valid:${authHeader.split(' ')[1]}`,
      );
      return session;
    } catch (err) {
      console.log(`Lỗi khi sign up: ${err}`);
      throw new InternalServerErrorException('Lỗi sign up');
    }
  }

  @Post('forgot-password')
  @Public()
  forgotPassword(@Body('phone') phone: string) {
    console.log(phone);
    return this.authService.forgotPassword(phone);
  }

  @Post('reset-password')
  @Public()
  @RequireTempPurpose(Purpose.ForgotPassword)
  @UseGuards(TempVerifyGuard)
  async resetPassword(
    @Request() req,
    @Body() resetPasswordDto: ResetPasswordDto,
    @ClientContext() client: IClientInfo,
    @Headers('authorization') authHeader: string,
  ) {
    if (resetPasswordDto.confirmPassword !== resetPasswordDto.newPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp !');
    }

    const session = await this.authService.resetPassword(
      req.user,
      resetPasswordDto.newPassword,
      client,
    );
    await this.redisService.del(`tmp_token_valid:${authHeader.split(' ')[1]}`);

    return session;
  }

  @Post('signin-with-temp')
  @Public()
  @RequireTempPurpose(Purpose.ForgotPassword)
  @UseGuards(TempVerifyGuard)
  async loginWithTemp(
    @Request() req,
    @ClientContext() client: IClientInfo,
    @Headers('authorization') authHeader: string,
  ) {
    const session = this.authService.signIn(
      {
        userId: req.user.userId as string,
        phone: req.user.phone as string,
        name: req.user.name as string,
      },
      client,
    );

    await this.redisService.del(`tmp_token_valid:${authHeader.split(' ')[1]}`);

    return session;
  }

  @Post('sign-in')
  @Public()
  @UseGuards(LocalAuthGuard)
  async logIn(
    @Request() req: any,
    @ClientContext() client: IClientInfo,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.signIn(req.user, client);

    const isProduction = process.env.NODE_ENV === 'production';

    // Set Cookie cho Web (Mobile sẽ lờ đi cái này)
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: isProduction, // Chỉ bật secure trên production (HTTPS)
      sameSite: isProduction ? 'none' : 'lax', // 'none' cho cross-site production, 'lax' cho local
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return result;
  }

  @Post('sign-out')
  @UseGuards(JwtAuthGuard)
  async logOut(
    @Request() req: { user: AuthUser; cookies: any },
    @Body('refreshToken') bodyToken: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const token = (req.cookies?.refreshToken as string) || bodyToken;

      const result = await this.authService.signOut(req.user.userId, token);

      const isProduction = process.env.NODE_ENV === 'production';

      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/',
      });

      return result;
    } catch (err: any) {
      console.log(err);
      throw new InternalServerErrorException(err);
    }
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @Request() req: { user: AuthUser },
    @Body() changePasswordDTO: ChangePasswordDTO,
    @ClientContext() client: IClientInfo,
  ) {
    return this.authService.changePassword(
      changePasswordDTO.oldPassword,
      changePasswordDTO.newPassword,
      changePasswordDTO.confirmPassword,
      req.user.phone,
      req.user.userId,
      client.deviceId,
    );
  }

  @Post('update-phone/request')
  @UseGuards(JwtAuthGuard)
  requestUpdatePhone(
    @Request() req: { user: AuthUser },
    @Body('phone') phone: string,
  ) {
    if (!phone) {
      throw new BadRequestException('Số điện thoại không được để trống !');
    }
    return this.authService.requestUpdatePhone(req.user.userId, phone);
  }

  @Post('update-phone/verify')
  @UseGuards(JwtAuthGuard)
  verifyUpdatePhone(
    @Request() req: { user: AuthUser },
    @Body('phone') phone: string,
    @Body('otp') otp: string,
    @ClientContext() client: IClientInfo,
  ) {
    if (!phone || !otp) {
      throw new BadRequestException('Số điện thoại và mã OTP không được để trống !');
    }
    return this.authService.verifyUpdatePhone(req.user.userId, phone, otp, client.deviceId);
  }

  @Post('token/refresh')
  @Public()
  refreshToken(@Request() req, @Body('refreshToken') bodyToken: string) {
    const token = (req.cookies?.refreshToken as string) || bodyToken;
    if (!token) {
      throw new BadRequestException('Refresh token không tồn tại !');
    }
    return this.authService.refresh(token);
  }

  @Get('sessions')
  getSessions(@Request() req: any) {
    return this.sessionService.getAll(req.user?.userId);
  }

  // api này chỉ để test
  @Get('profile')
  profile(@Request() req) {
    return req.user as AuthUser;
  }

  @Post('logout-others')
  async logoutOthers(
    @Request() req: any,
    @ClientContext() client: IClientInfo,
  ) {
    return this.authService.signOutOtherDevices(
      req.user.userId,
      client.deviceId,
    );
  }

  // API: Đăng xuất một máy cụ thể (truyền deviceId vào body)
  @Post('logout-device')
  async logoutDevice(
    @Request() req: any,
    @Body('deviceId') targetDeviceId: string,
  ) {
    return this.authService.signOutSpecificDevice(
      req.user.userId,
      targetDeviceId,
    );
  }

  //khi người dùng mobile quét qr sẽ kích hoạt api này
  @Post('qr-login/scan')
  async scanQrCode(
    @Request() req: { user: AuthUser },
    @Body() body: { qrToken: string },
  ) {
    const clientInfo = await this.authService.scanLoginQRCode(
      req.user,
      body.qrToken,
    );

    if (!clientInfo)
      throw new BadRequestException('Mã QR hết hạn hoặc không hợp lệ');

    return {
      message: 'Quét mã thành công',
      device: clientInfo, // Chứa deviceName, ip, location, deviceType...
    };
  }

  @Post('qr-login/confirm')
  async confirmQrLogin(
    @Request() req: { user: AuthUser },
    @Body() body: { qrToken: string },
  ) {
    const { qrToken } = body;

    if (!qrToken) {
      throw new BadRequestException('Thiếu thông tin xác nhận');
    }
    await this.authService.confirmLoginQr(req.user, qrToken);

    return { message: 'Xác nhận đăng nhập thành công' };
  }

  @Post('qr-login/exchange')
  @Public()
  async exchangeTicket(
    @Body() body: { ticket: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const rs = await this.authService.exchangeTicket(body.ticket);

      const isProduction = process.env.NODE_ENV === 'production';

      res.cookie('refreshToken', rs.refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      return rs;
    } catch (err) {
      console.log(err);
    }
  }
}
