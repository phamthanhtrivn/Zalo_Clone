import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TokenService {
  constructor(
    private jwt: JwtService,
    private configService: ConfigService,
  ) {}

  async signAccess(payload: any) {
    return await this.jwt.signAsync(payload, {
      secret: this.configService.get<string>('access_secret'),
      expiresIn: '15m',
    });
  }

  async signRefresh(payload: any) {
    return await this.jwt.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '30d',
    });
  }

  async signTempVerify(payload: any) {
    return await this.jwt.signAsync(payload, {
      secret: this.configService.get<string>('tmp_secret'),
      expiresIn: '30m',
    });
  }
}
