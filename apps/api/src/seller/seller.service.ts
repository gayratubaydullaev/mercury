import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class SellerService {
  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
  ) {}

  async getShop(userId: string) {
    const shop = await (this.prisma as any).shop.findFirst({
      where: { userId },
      include: {
        pendingUpdates: { where: { status: 'PENDING' }, take: 1, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!shop) return null;
    const { pendingUpdates, ...rest } = shop;
    const pending = pendingUpdates?.[0];
    return {
      ...rest,
      pendingUpdate: pending
        ? {
            requestedName: pending.requestedName,
            requestedSlug: pending.requestedSlug,
            requestedDescription: pending.requestedDescription,
            createdAt: pending.createdAt,
          }
        : null,
    };
  }

  /**
   * Изменения имени, slug и описания магазина попадают в PendingShopUpdate и вступают в силу после одобрения админа.
   * pickupAddress и chatEnabled обновляются сразу.
   */
  async createOrUpdateShop(
    userId: string,
    data: {
      name: string;
      slug?: string;
      description?: string;
      pickupAddress?: { city?: string; district?: string; street?: string; house?: string; phone?: string } | null;
      chatEnabled?: boolean;
    },
  ) {
    const shop = await this.prisma.shop.findFirst({ where: { userId } });
    if (!shop) throw new BadRequestException('Doʻkon topilmadi. Avval ariza topshiring va admin tasdiqlashini kuting.');

    const baseSlug = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const slug = (data.slug ?? (baseSlug || 'shop')).slice(0, 100);

    if (data.name !== undefined || data.description !== undefined || data.slug !== undefined) {
      await (this.prisma as any).pendingShopUpdate.upsert({
        where: { shopId: shop.id },
        create: {
          shopId: shop.id,
          requestedName: data.name.trim(),
          requestedSlug: slug,
          requestedDescription: data.description ?? null,
          status: 'PENDING',
        },
        update: {
          requestedName: data.name.trim(),
          requestedSlug: slug,
          requestedDescription: data.description ?? null,
          status: 'PENDING',
        },
      });
    }

    const shopUpdate: Record<string, unknown> = {};
    if (data.pickupAddress !== undefined) shopUpdate.pickupAddress = data.pickupAddress;
    if (typeof data.chatEnabled === 'boolean') shopUpdate.chatEnabled = data.chatEnabled;
    if (Object.keys(shopUpdate).length > 0) {
      await this.prisma.shop.update({
        where: { id: shop.id },
        data: shopUpdate,
      });
    }

    return this.getShop(userId);
  }

  async setChatEnabled(userId: string, chatEnabled: boolean) {
    const shop = await this.prisma.shop.findFirst({ where: { userId } });
    if (!shop) return null;
    return this.prisma.shop.update({
      where: { id: shop.id },
      data: { chatEnabled },
    });
  }

  async getStats(userId: string) {
    const shop = await this.prisma.shop.findFirst({ where: { userId } });
    if (!shop) {
      return { ordersCount: 0, pendingOrdersCount: 0, totalRevenue: '0', productsCount: 0, shopSlug: null };
    }
    const [ordersCount, pendingOrdersCount, sum, productsCount] = await Promise.all([
      this.prisma.order.count({ where: { sellerId: userId } }),
      this.prisma.order.count({ where: { sellerId: userId, status: 'PENDING' } }),
      this.prisma.order.aggregate({ _sum: { totalAmount: true }, where: { sellerId: userId, paymentStatus: 'PAID' } }),
      this.prisma.product.count({ where: { shopId: shop.id, isActive: true } }),
    ]);
    return {
      ordersCount,
      pendingOrdersCount,
      totalRevenue: sum._sum.totalAmount?.toString() ?? '0',
      productsCount,
      shopSlug: shop.slug,
    };
  }

  async linkTelegram(userId: string, code: string): Promise<{ ok: boolean }> {
    const chatId = await this.telegram.resolveLinkCode(code);
    if (!chatId) throw new BadRequestException('Kod notoʻgʻri yoki muddati tugagan. Botda /start yoki /link bosing va yangi kod oling.');
    const shop = await this.prisma.shop.findFirst({ where: { userId } });
    if (!shop) throw new BadRequestException('Doʻkon topilmadi.');
    const chatType = 'PERSONAL';
    // Bir chat faqat bitta doʻkonga ulanishi kerak: boshqa doʻkonlardan bu chatId ni olib tashlaymiz
    await this.prisma.shop.updateMany({
      where: { telegramChatId: chatId, id: { not: shop.id } },
      data: { telegramChatId: null, telegramType: null },
    });
    await this.prisma.shop.update({
      where: { id: shop.id },
      data: { telegramChatId: chatId, telegramType: chatType },
    });
    return { ok: true };
  }

  async getTelegramStatus(userId: string): Promise<{ connected: boolean; telegramType?: string }> {
    const shop = await this.prisma.shop.findFirst({ where: { userId }, select: { telegramChatId: true, telegramType: true } });
    return {
      connected: !!shop?.telegramChatId,
      telegramType: shop?.telegramType ?? undefined,
    };
  }

  async disconnectTelegram(userId: string): Promise<{ ok: boolean }> {
    const shop = await this.prisma.shop.findFirst({ where: { userId } });
    if (!shop) return { ok: true };
    await this.prisma.shop.update({
      where: { id: shop.id },
      data: { telegramChatId: null, telegramType: null },
    });
    return { ok: true };
  }

  /** Reviews for all products of the seller's shop (for reply UI) */
  async getReviewsForShop(userId: string) {
    const shop = await this.prisma.shop.findFirst({ where: { userId } });
    if (!shop) return [];
    return this.prisma.review.findMany({
      where: { product: { shopId: shop.id } },
      include: {
        user: { select: { firstName: true, lastName: true } },
        product: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
