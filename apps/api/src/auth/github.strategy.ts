import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { AuthService } from './auth.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  private readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly auth: AuthService,
  ) {
    const clientID = config.get<string>('GITHUB_CLIENT_ID') ?? '';
    const clientSecret = config.get<string>('GITHUB_CLIENT_SECRET') ?? '';
    const base = config.get<string>('OAUTH_CALLBACK_BASE') ?? '';
    const enabled = !!(clientID && clientSecret && base);
    super({
      clientID: enabled ? clientID : 'not-configured',
      clientSecret: enabled ? clientSecret : 'not-configured',
      callbackURL: enabled
        ? `${base.replace(/\/$/, '')}/github/callback`
        : 'http://127.0.0.1:1/not-used',
      scope: ['user:email'],
    });
    this.enabled = enabled;
  }

  authenticate(
    req: Parameters<Strategy['authenticate']>[0],
    options?: Parameters<Strategy['authenticate']>[1],
  ) {
    if (!this.enabled) {
      throw new BadRequestException('GitHub sign-in is not configured');
    }
    return super.authenticate(req, options);
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ) {
    const email =
      profile.emails?.find(
        (e: { value: string; primary?: boolean }) => e.primary,
      )?.value ?? profile.emails?.[0]?.value;
    if (!email) {
      throw new BadRequestException(
        'GitHub did not return an email. Grant the user:email scope.',
      );
    }
    return this.auth.upsertOAuthUser({
      provider: 'github',
      providerUserId: String(profile.id),
      email,
    });
  }
}
