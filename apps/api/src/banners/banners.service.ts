import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';

const BANNERS_CACHE_KEY = 'banners:active';
const BANNERS_CACHE_TTL_SEC = 60;

@Injectable()
export class BannersService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  /** Public: active banners only, within startsAt/endsAt, ordered by sortOrder. Cached 1 min when Redis available. */
  async getActive() {
    const cached = await this.cache.get<Awaited<ReturnType<BannersService['getActiveFromDb']>>>(BANNERS_CACHE_KEY);
    if (cached) return cached;
    const data = await this.getActiveFromDb();
    await this.cache.set(BANNERS_CACHE_KEY, data, BANNERS_CACHE_TTL_SEC);
    return data;
  }

  private getActiveFromDb() {
    const now = new Date();
    return this.prisma.banner.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, image: true, href: true, external: true, title: true, displaySeconds: true },
    });
  }

  /** Invalidate banners cache (call after admin create/update/delete). */
  async invalidateCache() {
    await this.cache.del(BANNERS_CACHE_KEY);
  }
}
