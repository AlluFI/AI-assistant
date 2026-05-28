import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as jwt from 'jsonwebtoken';
import type Redis from 'ioredis';
import { REDIS } from '../redis/redis.constants';

type RefreshPayload = { sub: string; fam: string; jti: string; typ: string };

@Injectable()
export class RefreshTokenService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  private get refreshSecret() {
    return this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  private get refreshTtlSec() {
    return Number(
      this.config.get<string>('JWT_REFRESH_EXPIRES_SEC') ?? 60 * 60 * 24 * 7,
    );
  }

  private signRefresh(userId: string, familyId: string, jti: string) {
    return jwt.sign(
      { sub: userId, fam: familyId, jti, typ: 'refresh' },
      this.refreshSecret,
      { expiresIn: this.refreshTtlSec },
    );
  }

  verifyRefreshTokenShape(token: string): RefreshPayload {
    try {
      const p = jwt.verify(token, this.refreshSecret) as jwt.JwtPayload;
      if (
        p.typ !== 'refresh' ||
        typeof p.sub !== 'string' ||
        typeof p.fam !== 'string' ||
        typeof p.jti !== 'string'
      ) {
        throw new Error('bad payload');
      }
      return p as RefreshPayload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async createSession(userId: string) {
    const familyId = randomUUID();
    const jti = randomUUID();
    const token = this.signRefresh(userId, familyId, jti);
    const ttl = this.refreshTtlSec;
    const pipeline = this.redis.pipeline();
    pipeline.set(`rf:${familyId}`, jti, 'EX', ttl);
    pipeline.sadd(`uf:${userId}`, familyId);
    pipeline.expire(`uf:${userId}`, Math.max(ttl, 86400 * 30));
    await pipeline.exec();
    return { refreshToken: token, familyId };
  }

  async rotate(refreshToken: string) {
    const { sub, fam, jti } = this.verifyRefreshTokenShape(refreshToken);
    const current = await this.redis.get(`rf:${fam}`);
    if (current === null) {
      throw new UnauthorizedException('Session expired or revoked');
    }
    if (current !== jti) {
      await this.revokeFamilyById(fam, sub);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    const newJti = randomUUID();
    const newRt = this.signRefresh(sub, fam, newJti);
    await this.redis.set(`rf:${fam}`, newJti, 'EX', this.refreshTtlSec);
    return { userId: sub, refreshToken: newRt };
  }

  async revokeByRefreshToken(refreshToken: string) {
    const { sub, fam } = this.verifyRefreshTokenShape(refreshToken);
    await this.revokeFamilyById(fam, sub);
  }

  async revokeFamilyById(familyId: string, userId: string) {
    await this.redis.del(`rf:${familyId}`);
    await this.redis.srem(`uf:${userId}`, familyId);
  }

  async revokeAllForUser(userId: string) {
    const families = await this.redis.smembers(`uf:${userId}`);
    const pipeline = this.redis.pipeline();
    for (const fam of families) {
      pipeline.del(`rf:${fam}`);
    }
    pipeline.del(`uf:${userId}`);
    await pipeline.exec();
  }
}
