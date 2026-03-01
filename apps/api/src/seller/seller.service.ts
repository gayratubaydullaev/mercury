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
    return this.prisma.shop.findFirst({ where: { userId } });
  }

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
    const slug = data.slug ?? data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const update: Record<string, unknown> = {
      name: data.name,
      slug,
      description: data.description,
      pickupAddress: data.pickupAddress ?? undefined,
    };
    if (typeof data.chatEnabled === 'boolean') update.chatEnabled = data.chatEnabled;
    return this.prisma.shop.upsert({
      where: { userId },
      create: {
        userId,
        name: data.name,
        slug,
        description: data.description,
        pickupAddress: data.pickupAddress ?? undefined,
        chatEnabled: data.chatEnabled ?? true,
      },
      update,
    });
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
