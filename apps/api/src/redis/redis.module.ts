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
        const client = new Redis(url, {
          maxRetriesPerRequest: null,
          connectTimeout: 10_000,
          retryStrategy: (times) => Math.min(times * 200, 3_000),
        });
        client.on('error', (err: Error) => {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[redis]', err.message);
          }
        });
        return client;
      },
      inject: [ConfigService],
    },
    RedisLifecycle,
  ],
  exports: [REDIS],
})
export class RedisModule {}
