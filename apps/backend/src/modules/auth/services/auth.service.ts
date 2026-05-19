import { TempVerifyPayload } from './../types/tmp-verify-payload.type';
import { UsersService } from '../../users/users.service';
import { RedisService } from '../../../common/redis/redis.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthUser } from '../types/auth.type';
import { TokenService } from '../../../common/jwt-token/jwt.service';
import { SessionService } from './session.service';
import { Purpose } from '../dto/verify-otp.dto';
import { Gender } from 'src/common/types/enums/gender';
import crypto from 'crypto';
import { ChatGateway } from 'src/modules/chat/chat.gateway';
import { StorageService } from 'src/common/storage/storage.service';
import { AuthGateway } from '../auth.gateway';
import { IClientInfo } from '../decorator/client-info.decorator';
@Injectable()
export class AuthService {
  constructor(
    private redisService: RedisService,
    private userService: UsersService,
    private tokenService: TokenService,
    private sessionService: SessionService,
    private chatGateway: ChatGateway,
    private authGateway: AuthGateway,
    private readonly storageService: StorageService,
  ) { }

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
      Number(process.env.OTP_EXPIRE_SECONDS) || 300,
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

  async verifyOtp(phone: string, otp: string, purpose: Purpose) {
    const user = await this.userService.findByPhone(phone);
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
      purpose,
      type: 'temp_verify',
      userId: user?._id,
    } as TempVerifyPayload);
    return { message: 'Xác thực thành công', tmp_token };
  }

  async verifyOtpOnly(phone: string, otp: string) {
    const savedOtp = await this.redisService.get(this.otpKey(phone));

    if (!savedOtp) {
      throw new BadRequestException('OTP đã hết hạn !');
    }

    if (otp !== savedOtp) {
      throw new BadRequestException('Nhập sai mã OTP !');
    }

    await this.redisService.del(this.otpKey(phone));
    return true;
  }

  async forgotPassword(phone: string) {
    const user = await this.userService.findByPhone(phone);
    if (!user) {
      throw new NotFoundException('Số điện thoại chưa được đăng ký');
    }
    if (await this.sendOtp(phone)) {
      return {
        message: 'Mã otp đã được gọi. Vui lòng kiểm tra hộp thư !',
        expiresIn: process.env.OTP_RESEND_SECONDS,
      };
    }
  }

  async signOutAllDevices(userId: string, currentDeviceId?: string) {
    const { deviceIds } = await this.sessionService.removeAllSessions(userId);

    for (const deviceId of deviceIds) {
      if (deviceId !== currentDeviceId) {
        this.chatGateway.forceLogoutDevice(deviceId);
      }
    }

    // Ép trạng thái hoạt động offline và cập nhật lastSeen ngay lập tức
    await this.chatGateway.forceOfflineUser(userId);
  }

  async resetPassword(user: AuthUser, password: string, client: IClientInfo) {
    await this.userService.updatePassword(user.phone, password);

    await this.signOutAllDevices(user.userId, client.deviceId);

    return this.signIn(
      { userId: user.userId, phone: user.phone, name: user.name },
      client,
    );
  }

  // async logOut

  async signUp(phone: string) {
    const user = await this.userService.findByPhone(phone);
    if (user) {
      throw new ConflictException(
        'Số điện thoại đã được đăng ký. Vui lòng đăng nhập !',
      );
    }
    if (await this.sendOtp(phone)) {
      return {
        message: 'Mã otp đã được gọi. Vui lòng kiểm tra hộp thư !',
        expiresIn: process.env.OTP_RESEND_SECONDS,
      };
    }
  }

  async completeSignUp(
    phone: string,
    name: string,
    gender: Gender,
    birthday: Date,
    password: string,
    client: IClientInfo,
  ) {
    const user = await this.userService.createRegister(
      phone,
      name,
      gender,
      birthday,
      password,
    );

    const authUser: AuthUser = {
      userId: user._id.toString(),
      phone: user.phone,
      name: user.profile?.name,
    };

    const authData = await this.signIn(authUser, client);

    return {
      message: 'Đăng ký thành công!',
      ...authData,
    };
  }

  async validateUser(phone: string, pass: string): Promise<AuthUser | null> {
    const user = await this.userService.findByPhone(phone);

    if (user && (await bcrypt.compare(pass, user.password))) {
      const avatar = this.storageService.signFileUrl(
        user.profile?.avatarUrl as string,
      );
      return {
        userId: String(user._id),
        avatarUrl: avatar as string,
        phone: user.phone,
        name: user.profile?.name,
      };
    }
    return null;
  }

  async refresh(refreshToken: string) {
    const payload = (await this.tokenService.verifyRefresh(
      refreshToken,
    )) as AuthUser;

    const session = await this.sessionService.findValidSession(
      payload.userId,
      refreshToken,
    );

    if (!session) {
      throw new UnauthorizedException('Phiên đăng nhập không tồn tại ');
    }

    const accessToken = await this.tokenService.signAccess({
      userId: payload.userId,
      phone: payload.phone,
    });

    return { accessToken };
  }

  async signIn(user: AuthUser, client: IClientInfo) {
    await this.sessionService.removeByDevice(user.userId, client.deviceId);

    const accessToken = await this.tokenService.signAccess(user);
    const refreshToken = await this.tokenService.signRefresh(user);

    const hashToken = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    await this.sessionService.create(
      user.userId,
      hashToken,
      new Date(this.tokenService.decode(refreshToken).exp * 1000),
      client.deviceId,
      client.deviceName,
      client.deviceType,
      client.ip,
      client.location,
    );

    return { accessToken, refreshToken, user };
  }

  async changePassword(
    oldPassword: string,
    newPassword: string,
    confirmPassword: string,
    phone: string,
    userId: string,
    currentDeviceId?: string,
  ) {
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp !');
    }
    await this.userService.checkMatchPassword(phone, oldPassword);
    await this.userService.updatePassword(phone, newPassword);

    await this.signOutAllDevices(userId, currentDeviceId);

    return { message: 'Đổi mật khẩu thành công' };
  }

  async requestUpdatePhone(userId: string, newPhone: string) {
    const existingUser = await this.userService.findByPhone(newPhone);
    if (existingUser) {
      throw new BadRequestException('Số điện thoại mới đã được đăng ký bởi một tài khoản khác !');
    }

    await this.sendOtp(newPhone);

    return { message: 'Mã OTP đã được gửi tới số điện thoại mới thành công.' };
  }

  async verifyUpdatePhone(userId: string, newPhone: string, otp: string, currentDeviceId?: string) {
    await this.verifyOtpOnly(newPhone, otp);

    const existingUser = await this.userService.findByPhone(newPhone);
    if (existingUser) {
      throw new BadRequestException('Số điện thoại mới đã được đăng ký bởi một tài khoản khác !');
    }

    await this.userService.updatePhone(userId, newPhone);

    await this.signOutAllDevices(userId, currentDeviceId);

    return { message: 'Cập nhật số điện thoại thành công.' };
  }

  async signOut(userId: string, refreshToken: string) {
    const deleted = await this.sessionService.remove(userId, refreshToken);

    if (deleted) {
      return { message: 'Đăng xuất thành công !' };
    } else {
      throw new UnauthorizedException('Không có phiên đăng nhập !');
    }
  }

  async signOutOtherDevices(userId: string, currentDeviceId: string) {
    const sessionsToKill = await this.sessionService.findOtherSessions(
      userId,
      currentDeviceId,
    );

    if (sessionsToKill.length === 0) {
      return { message: 'Không có thiết bị nào khác để đăng xuất.' };
    }

    const deletedCount = await this.sessionService.removeAllOtherDevices(
      userId,
      currentDeviceId,
    );

    for (const session of sessionsToKill) {
      this.chatGateway.forceLogoutDevice(session.deviceId);
    }

    return {
      message: `Đã đăng xuất thành công khỏi ${deletedCount.deletedCount} thiết bị khác!`,
      deletedCount: deletedCount.deletedCount,
    };
  }

  async signOutSpecificDevice(userId: string, targetDeviceId: string) {
    const deleted = await this.sessionService.removeByDevice(
      userId,
      targetDeviceId,
    );
    if (!deleted) {
      throw new NotFoundException(
        'Không tìm thấy phiên đăng nhập của thiết bị này.',
      );
    }
    this.chatGateway.forceLogoutDevice(targetDeviceId);
    return { message: 'Đã đăng xuất thiết bị thành công.' };
  }

  async scanLoginQRCode(user: AuthUser, qrToken: string) {
    const rs = await this.authGateway.notifyQrScanned(qrToken, user);
    return rs;
  }

  async confirmLoginQr(user: AuthUser, qrToken: string) {
    const sessionDataStr = await this.redisService.get(`qr:${qrToken}`);
    if (!sessionDataStr) throw new BadRequestException('Mã QR đã hết hạn');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const sessionData = JSON.parse(sessionDataStr);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unused-vars
    const { iat, exp, ...cleanUser } = user as any;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    sessionData.user = cleanUser;
    await this.redisService.set(
      `qr:${qrToken}`,
      JSON.stringify(sessionData),
      'EX',
      30,
    );
    this.authGateway.confirmLoginForDevice(qrToken);
  }

  // đăng nhập dùm web khi xác nhận xong
  async exchangeTicket(ticket: string) {
    try {
      const data = await this.redisService.get(`qr:${ticket}`);
      if (!data)
        throw new BadRequestException('Vé đổi không hợp lệ hoặc đã hết hạn');

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { clientInfo, user } = JSON.parse(data);
      if (!user) throw new BadRequestException('Vé chưa được xác nhận');

      const rs = await this.signIn(user, clientInfo);

      await this.redisService.del(`qr:${ticket}`);
      return rs;
    } catch (err) {
      console.log(err);
      throw err;
    }
  }
}
