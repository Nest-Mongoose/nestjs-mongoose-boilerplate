import { type Configuration, configuration } from '@/config/configuration.js';
import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AuthService } from '../auth.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    @Inject(configuration.KEY) config: Configuration,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.auth.user.secret,
    });
  }

  async validate(payload: { email: string }) {
    return this.authService.findAuthenticatedUserByEmail(payload.email);
  }
}
