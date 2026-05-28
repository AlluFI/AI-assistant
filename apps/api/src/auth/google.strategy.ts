import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { AuthService } from './auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly auth: AuthService,
  ) {
    const clientID = config.get<string>('GOOGLE_CLIENT_ID') ?? '';
    const clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET') ?? '';
    const base = config.get<string>('OAUTH_CALLBACK_BASE') ?? '';
    const enabled = !!(clientID && clientSecret && base);
    super({
      clientID: enabled ? clientID : 'not-configured',
      clientSecret: enabled ? clientSecret : 'not-configured',
      callbackURL: enabled
        ? `${base.replace(/\/$/, '')}/google/callback`
        : 'http://127.0.0.1:1/not-used',
      scope: ['email', 'profile'],
    });
    this.enabled = enabled;
  }

  authenticate(
    req: Parameters<Strategy['authenticate']>[0],
    options?: Parameters<Strategy['authenticate']>[1],
  ) {
    if (!this.enabled) {
      throw new BadRequestException('Google sign-in is not configured');
    }
    return super.authenticate(req, options);
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ) {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new BadRequestException('Google did not return an email address');
    }
    return this.auth.upsertOAuthUser({
      provider: 'google',
      providerUserId: profile.id,
      email,
    });
  }
}
