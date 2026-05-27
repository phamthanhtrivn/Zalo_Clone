import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthUser } from '../types/auth.type';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('access_secret'),
    });
  }

  async validate(payload: AuthUser) {
    const user = await this.usersService.findById(payload.userId);
    if (user?.isLocked) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa. Vui lòng mở khóa để tiếp tục sử dụng.');
    }
    return payload;
  }
}
