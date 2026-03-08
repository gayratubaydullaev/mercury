import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CacheService } from './cache.service';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        if (!url?.trim()) return null;
        const client = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: true });
        client.on('error', () => {}); // avoid Unhandled error event when Redis is not running
        return client;
      },
      inject: [ConfigService],
    },
    CacheService,
  ],
  exports: [REDIS_CLIENT, CacheService],
})
export class RedisModule {}
