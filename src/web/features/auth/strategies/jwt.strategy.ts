import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { ENV } from '@/shared/enums';
import { User } from '@/shared/schemas/user.schema';

import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get(ENV.USER_SECRET),
    });
  }

  async validate(payload: Pick<User, 'email'>) {
    const user = await this.authService.findUserByEmail(payload.email);
    if (!user) {
      return null;
    }
    delete user.password;

    return user;
  }
}
