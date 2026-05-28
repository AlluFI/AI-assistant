import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenService } from './refresh-token.service';
import { REDIS } from '../redis/redis.constants';
import type Redis from 'ioredis';

const EMAIL_VERIFY_TTL_MS = 48 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const EMAIL_CHANGE_TTL_MS = 24 * 60 * 60 * 1000;
const TOTP_SETUP_TTL_SEC = 600;
const MFA_TOKEN_SEC = 300;
const BACKUP_CODE_COUNT = 10;
const OAUTH_STATE_TTL_SEC = 300;
const CSRF_TTL_SEC = 60 * 60 * 24;

function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function generateBackupCodesPlain() {
  const codes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i += 1) {
    codes.push(randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
    private readonly refresh: RefreshTokenService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        displayName: dto.displayName?.trim() || null,
        passwordHash,
      },
    });

    const token = randomBytes(32).toString('hex');
    const tokenHash = sha256Hex(token);

    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
      },
    });

    await this.mail.sendVerificationEmail(email, token);

    return {
      message:
        'Registration successful. Check your email to verify your account.',
      userId: user.id,
    };
  }

  async verifyEmail(token: string) {
    const tokenHash = sha256Hex(token);
    const record = await this.prisma.emailVerificationToken.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!record) {
      throw new BadRequestException('Invalid or expired verification token.');
    }

    if (record.user.emailVerifiedAt) {
      await this.prisma.emailVerificationToken.deleteMany({
        where: { userId: record.userId },
      });
      return { message: 'Email was already verified.' };
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.deleteMany({
        where: { userId: record.userId },
      }),
    ]);

    return { message: 'Email verified successfully.' };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException(
        'Please verify your email before signing in.',
      );
    }

    if (user.totpEnabled) {
      const mfaToken = await this.jwt.signAsync(
        { sub: user.id, typ: 'mfa' },
        { expiresIn: MFA_TOKEN_SEC },
      );
      return {
        mfaRequired: true as const,
        mfaToken,
        mfaExpiresInSec: MFA_TOKEN_SEC,
      };
    }

    return this.issueTokenPair(user.id);
  }

  async completeMfaLogin(
    mfaToken: string,
    totpCode?: string,
    backupCode?: string,
  ) {
    let sub: string;
    try {
      const p = await this.jwt.verifyAsync<{ sub: string; typ?: string }>(
        mfaToken,
      );
      if (p.typ !== 'mfa' || !p.sub) {
        throw new UnauthorizedException('Invalid MFA token');
      }
      sub = p.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired MFA token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: sub } });
    if (!user?.totpEnabled || !user.totpSecret) {
      throw new BadRequestException('Two-factor authentication is not active.');
    }

    if (totpCode) {
      const result = verifySync({ token: totpCode, secret: user.totpSecret });
      if (!result.valid) {
        throw new UnauthorizedException('Invalid authenticator code');
      }
    } else if (backupCode) {
      const raw = backupCode.trim().toUpperCase();
      const hashes = (user.backupCodes as string[] | null) ?? [];
      const matchHash = sha256Hex(raw);
      if (!hashes.includes(matchHash)) {
        throw new UnauthorizedException('Invalid backup code');
      }
      const next = hashes.filter((h) => h !== matchHash);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { backupCodes: next },
      });
    } else {
      throw new BadRequestException('Provide totpCode or backupCode');
    }

    return this.issueTokenPair(user.id);
  }

  async issueTokenPair(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      typ: 'access',
    });
    const { refreshToken } = await this.refresh.createSession(user.id);
    return {
      userId: user.id,
      accessToken,
      refreshToken,
      tokenType: 'Bearer' as const,
    };
  }

  async refreshTokens(refreshToken: string) {
    const { userId, refreshToken: newRt } =
      await this.refresh.rotate(refreshToken);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      typ: 'access',
    });
    return {
      userId: user.id,
      accessToken,
      refreshToken: newRt,
      tokenType: 'Bearer' as const,
    };
  }

  async logout(refreshToken: string) {
    await this.refresh.revokeByRefreshToken(refreshToken);
    return { message: 'Session revoked.' };
  }

  async logoutAll(userId: string) {
    await this.refresh.revokeAllForUser(userId);
    return { message: 'All sessions revoked.' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        emailVerifiedAt: true,
        totpEnabled: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }

  async upsertOAuthUser(params: {
    provider: string;
    providerUserId: string;
    email: string;
  }) {
    const email = params.email.trim().toLowerCase();
    const link = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: params.provider,
          providerUserId: params.providerUserId,
        },
      },
      include: { user: true },
    });
    if (link) {
      return { userId: link.user.id };
    }

    let user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      if (!user.emailVerifiedAt) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: new Date() },
        });
      }
      await this.prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: params.provider,
          providerUserId: params.providerUserId,
        },
      });
      return { userId: user.id };
    }

    const created = await this.prisma.user.create({
      data: {
        email,
        displayName: email.split('@')[0] || null,
        emailVerifiedAt: new Date(),
        oauthAccounts: {
          create: {
            provider: params.provider,
            providerUserId: params.providerUserId,
          },
        },
      },
    });
    return { userId: created.id };
  }

  async forgotPassword(emailRaw: string) {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) {
      return {
        message:
          'If an account exists for that email, password reset instructions were sent.',
      };
    }

    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    const token = randomBytes(32).toString('hex');
    const tokenHash = sha256Hex(token);
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });

    await this.mail.sendPasswordResetEmail(email, token);

    return {
      message:
        'If an account exists for that email, password reset instructions were sent.',
    };
  }

  async updateAccount(userId: string, dto: { displayName?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName:
          dto.displayName === undefined
            ? undefined
            : dto.displayName.trim() || null,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        emailVerifiedAt: true,
        totpEnabled: true,
        createdAt: true,
      },
    });
    return { user };
  }

  async requestEmailChange(userId: string, newEmailRaw: string) {
    const newEmail = newEmailRaw.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (user.email === newEmail) {
      throw new BadRequestException('New email is the same as current email.');
    }
    const exists = await this.prisma.user.findUnique({
      where: { email: newEmail },
    });
    if (exists) {
      throw new ConflictException('An account with this email already exists.');
    }

    await this.prisma.emailChangeToken.deleteMany({ where: { userId } });
    const token = randomBytes(32).toString('hex');
    const tokenHash = sha256Hex(token);
    await this.prisma.emailChangeToken.create({
      data: {
        userId,
        newEmail,
        tokenHash,
        expiresAt: new Date(Date.now() + EMAIL_CHANGE_TTL_MS),
      },
    });
    await this.mail.sendEmailChangeVerificationEmail(newEmail, token);
    return { message: 'Email change confirmation sent to new address.' };
  }

  async confirmEmailChange(token: string) {
    const tokenHash = sha256Hex(token);
    const record = await this.prisma.emailChangeToken.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!record) {
      throw new BadRequestException('Invalid or expired email-change token.');
    }

    const occupied = await this.prisma.user.findUnique({
      where: { email: record.newEmail },
    });
    if (occupied && occupied.id !== record.userId) {
      throw new ConflictException('This email is no longer available.');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: {
          email: record.newEmail,
          emailVerifiedAt: new Date(),
        },
      }),
      this.prisma.emailChangeToken.deleteMany({
        where: { userId: record.userId },
      }),
    ]);

    return { message: 'Email address updated successfully.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = sha256Hex(token);
    const record = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!record) {
      throw new BadRequestException('Invalid or expired reset token.');
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.deleteMany({
        where: { userId: record.userId },
      }),
    ]);

    await this.refresh.revokeAllForUser(record.userId);

    return { message: 'Password updated. Please sign in again.' };
  }

  async beginTotpSetup(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (user.totpEnabled) {
      throw new ConflictException(
        'Two-factor authentication is already enabled.',
      );
    }

    const secret = generateSecret();
    await this.redis.set(
      `totp:setup:${userId}`,
      secret,
      'EX',
      TOTP_SETUP_TTL_SEC,
    );

    const issuer = 'NumbersDontLie';
    const otpauth = generateURI({
      issuer,
      label: user.email,
      secret,
    });
    const qrDataUrl = await QRCode.toDataURL(otpauth);
    return {
      secret,
      otpauthUrl: otpauth,
      qrDataUrl,
      expiresInSec: TOTP_SETUP_TTL_SEC,
    };
  }

  async confirmTotpSetup(userId: string, code: string) {
    const secret = await this.redis.get(`totp:setup:${userId}`);
    if (!secret) {
      throw new BadRequestException(
        'No pending authenticator setup. Start setup again.',
      );
    }

    const result = verifySync({ token: code, secret });
    if (!result.valid) {
      throw new UnauthorizedException('Invalid authenticator code');
    }

    const plainBackup = generateBackupCodesPlain();
    const hashedBackup = plainBackup.map((c) => sha256Hex(c));

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: secret,
        totpEnabled: true,
        backupCodes: hashedBackup,
      },
    });

    await this.redis.del(`totp:setup:${userId}`);
    await this.refresh.revokeAllForUser(userId);

    return {
      message: 'Two-factor authentication enabled.',
      backupCodes: plainBackup,
    };
  }

  async disableTotp(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) {
      throw new BadRequestException(
        'Password login is not set for this account.',
      );
    }
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('Invalid password');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpEnabled: false,
        totpSecret: null,
        backupCodes: [],
      },
    });

    await this.redis.del(`totp:setup:${userId}`);
    await this.refresh.revokeAllForUser(userId);

    return { message: 'Two-factor authentication disabled.' };
  }

  async regenerateBackupCodes(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash || !user.totpEnabled) {
      throw new BadRequestException(
        'Two-factor authentication is not enabled.',
      );
    }
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('Invalid password');
    }

    const plainBackup = generateBackupCodesPlain();
    const hashedBackup = plainBackup.map((c) => sha256Hex(c));
    await this.prisma.user.update({
      where: { id: userId },
      data: { backupCodes: hashedBackup },
    });

    return { backupCodes: plainBackup };
  }

  async createOAuthState(provider: 'google' | 'github', sourceIp: string) {
    const state = randomBytes(24).toString('base64url');
    await this.redis.set(
      `oauth:state:${provider}:${state}`,
      sourceIp,
      'EX',
      OAUTH_STATE_TTL_SEC,
    );
    return state;
  }

  async consumeOAuthState(provider: 'google' | 'github', state?: string) {
    if (!state) {
      throw new UnauthorizedException('Missing OAuth state');
    }
    const key = `oauth:state:${provider}:${state}`;
    const existed = await this.redis.get(key);
    if (!existed) {
      throw new UnauthorizedException('Invalid or expired OAuth state');
    }
    await this.redis.del(key);
  }

  async issueCsrfToken(userId: string) {
    const token = randomBytes(24).toString('base64url');
    await this.redis.set(`csrf:${userId}:${token}`, '1', 'EX', CSRF_TTL_SEC);
    return token;
  }

  async verifyCsrfToken(userId: string, token?: string) {
    if (!token) return false;
    const ok = await this.redis.get(`csrf:${userId}:${token}`);
    return Boolean(ok);
  }

  getRefreshTokenUserId(refreshToken: string) {
    return this.refresh.verifyRefreshTokenShape(refreshToken).sub;
  }
}
