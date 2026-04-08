import { Injectable, Inject, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.module';

const DEFAULT_TTL_SEC = 60;

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null) {}

  async onModuleDestroy() {
    if (!this.redis) return;
    await this.redis.quit().catch((err: unknown) => {
      this.logger.warn('Redis quit failed', err);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(key);
      if (raw == null) return null;
      return JSON.parse(raw) as T;
    } catch (err: unknown) {
      this.logger.warn(`Cache get failed (key=${key})`, err);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSec = DEFAULT_TTL_SEC): Promise<void> {
    if (!this.redis) return;
    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttlSec, serialized);
    } catch (err: unknown) {
      this.logger.warn(`Cache set failed (key=${key})`, err);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(key);
    } catch (err: unknown) {
      this.logger.warn(`Cache del failed (key=${key})`, err);
    }
  }
}
