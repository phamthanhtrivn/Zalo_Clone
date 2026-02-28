import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthUser } from '../auth.type';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'phone' });
  }

  async validate(phone: string, password: string): Promise<AuthUser> {
    console.log('Validate run');
    const user = (await this.authService.validateUser(
      phone,
      password,
    )) as AuthUser;
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
