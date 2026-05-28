import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisLifecycle } from './redis-lifecycle.service';
import { REDIS } from './redis.constants';

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: (config: ConfigService) => {
        const url = config.getOrThrow<string>('REDIS_URL');
        return new Redis(url, { maxRetriesPerRequest: null });
      },
      inject: [ConfigService],
    },
    RedisLifecycle,
  ],
  exports: [REDIS],
})
export class RedisModule {}
