import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TokenService {
  constructor(private jwt: JwtService) {}

  async signAccess(payload: any) {
    return {
      accessToken: await this.jwt.signAsync(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '15m',
      }),
    };
  }

  async signRefresh(payload: any) {
    return {
      refreshToken: await this.jwt.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '30d',
      }),
    };
  }

  async signTempVerify(payload: any) {
    return {
      tempVerifyToken: await this.jwt.signAsync(payload, {
        secret: process.env.JWT_TEMP_SECRET,
        expiresIn: '30m',
      }),
    };
  }
}
