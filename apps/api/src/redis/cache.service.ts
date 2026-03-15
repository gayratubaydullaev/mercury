import { Injectable, Inject, OnModuleDestroy, Optional } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.module';

const DEFAULT_TTL_SEC = 60;

@Injectable()
export class CacheService implements OnModuleDestroy {
  constructor(@Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null) {}

  async onModuleDestroy() {
    if (this.redis) await this.redis.quit().catch(() => {});
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(key);
      if (raw == null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSec = DEFAULT_TTL_SEC): Promise<void> {
    if (!this.redis) return;
    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttlSec, serialized);
    } catch {
      // ignore
    }
  }

  async del(key: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(key);
    } catch {
    }
  }
}
