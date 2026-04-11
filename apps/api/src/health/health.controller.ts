import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';
import { Inject } from '@nestjs/common';
import { REDIS_CLIENT } from '../redis/redis.module';
import type Redis from 'ioredis';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    @Inject(REDIS_CLIENT) private redis: Redis | null,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Liveness — process is accepting requests' })
  live() {
    return { status: 'ok' as const };
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Readiness — database (and Redis if configured) are reachable' })
  async ready() {
    const checks: Record<string, 'ok' | 'skipped' | 'error'> = { database: 'ok' };
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      checks.database = 'error';
      return { status: 'not_ready' as const, checks };
    }
    if (this.redis) {
      checks.redis = 'ok';
      try {
        await this.redis.ping();
      } catch {
        checks.redis = 'error';
        return { status: 'not_ready' as const, checks };
      }
    } else {
      checks.redis = 'skipped';
    }
    return { status: 'ready' as const, checks };
  }
}
