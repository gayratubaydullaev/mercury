import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SellerService {
  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
    private notifications: NotificationsService,
  ) {}

  async getShop(userId: string) {
    const shop = await this.prisma.shop.findFirst({
      where: { userId },
      include: {
        pendingUpdates: { where: { status: 'PENDING' }, take: 1, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!shop) return null;
    const { pendingUpdates, ...rest } = shop;
    const pending = pendingUpdates?.[0];
    const docUrls = pending?.requestedDocumentUrls;
    return {
      ...rest,
      pendingUpdate: pending
        ? {
            requestedName: pending.requestedName,
            requestedSlug: pending.requestedSlug,
            requestedDescription: pending.requestedDescription,
            requestedLegalType: pending.requestedLegalType ?? null,
            requestedLegalName: pending.requestedLegalName ?? null,
            requestedOgrn: pending.requestedOgrn ?? null,
            requestedInn: pending.requestedInn ?? null,
            requestedDocumentUrls: Array.isArray(docUrls) ? docUrls : null,
            createdAt: pending.createdAt,
          }
        : null,
    };
  }

  /**
   * Изменения имени, slug, описания и реквизитов (ИП/ООО, ОГРН, ИНН, документы) попадают в PendingShopUpdate
   * и вступают в силу только после одобрения админа. pickupAddress и chatEnabled обновляются сразу.
   */
  async createOrUpdateShop(
    userId: string,
    data: {
      name: string;
      slug?: string;
      description?: string;
      pickupAddress?: { city?: string; district?: string; street?: string; house?: string; phone?: string } | null;
      chatEnabled?: boolean;
      legalType?: string | null;
      legalName?: string | null;
      ogrn?: string | null;
      inn?: string | null;
      documentUrls?: string[] | null;
    },
  ) {
    const shop = await this.prisma.shop.findFirst({ where: { userId } });
    if (!shop) throw new BadRequestException('Doʻkon topilmadi. Avval ariza topshiring va admin tasdiqlashini kuting.');

    const hasMain = data.name !== undefined || data.description !== undefined || data.slug !== undefined;
    const hasLegal =
      data.legalType !== undefined ||
      data.legalName !== undefined ||
      data.ogrn !== undefined ||
      data.inn !== undefined ||
      data.documentUrls !== undefined;

    if (hasMain || hasLegal) {
      const pending = await this.prisma.pendingShopUpdate.findUnique({ where: { shopId: shop.id } });

      const baseSlug = (data.name ?? shop.name ?? '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const slug = (data.slug ?? (baseSlug || shop.slug || 'shop')).slice(0, 100);

      const requestedName = (data.name ?? pending?.requestedName ?? shop.name).trim();
      const requestedDescription = data.description !== undefined ? (data.description?.trim() || null) : pending?.requestedDescription ?? shop.description ?? null;
      const requestedLegalType = data.legalType !== undefined ? (data.legalType?.trim() || null) : pending?.requestedLegalType ?? shop.legalType ?? null;
      const requestedLegalName = data.legalName !== undefined ? (data.legalName?.trim() || null) : pending?.requestedLegalName ?? shop.legalName ?? null;
      const requestedOgrn = data.ogrn !== undefined ? (data.ogrn?.trim() || null) : pending?.requestedOgrn ?? shop.ogrn ?? null;
      const requestedInn = data.inn !== undefined ? (data.inn?.trim() || null) : pending?.requestedInn ?? shop.inn ?? null;
      const requestedDocumentUrls =
        data.documentUrls !== undefined
          ? (Array.isArray(data.documentUrls) ? data.documentUrls : null)
          : pending?.requestedDocumentUrls ?? (Array.isArray(shop.documentUrls) ? shop.documentUrls : null);

      const docUrlsJson = Array.isArray(requestedDocumentUrls) ? requestedDocumentUrls : undefined;
      const pendingRecord = await this.prisma.pendingShopUpdate.upsert({
        where: { shopId: shop.id },
        create: {
          shopId: shop.id,
          requestedName,
          requestedSlug: slug,
          requestedDescription,
          requestedLegalType,
          requestedLegalName,
          requestedOgrn,
          requestedInn,
          requestedDocumentUrls: docUrlsJson,
          status: 'PENDING',
        },
        update: {
          requestedName,
          requestedSlug: slug,
          requestedDescription,
          requestedLegalType,
          requestedLegalName,
          requestedOgrn,
          requestedInn,
          requestedDocumentUrls: docUrlsJson,
          status: 'PENDING',
        },
      });
      this.notifications
        .createForAdmins({
          type: 'PENDING_SHOP_UPDATE',
          title: 'Doʻkon oʻzgarishlari',
          body: `${requestedName} — tasdiqlash kutilmoqda`,
          link: '/admin/pending-shop-updates',
          entityId: pendingRecord.id,
        })
        .catch(() => {});
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
    const shop = await this.prisma.shop.findFirst({ where: { userId }, select: { id: true, slug: true, commissionRate: true } });
    if (!shop) {
      return {
        ordersCount: 0,
        pendingOrdersCount: 0,
        totalRevenue: '0',
        productsCount: 0,
        shopSlug: null,
        commissionRate: null,
        commission: 0,
        totalPaidToPlatform: 0,
        balance: 0,
      };
    }
    const [ordersCount, pendingOrdersCount, paidOrders, productsCount, settings, payoutRecords] = await Promise.all([
      this.prisma.order.count({ where: { sellerId: userId } }),
      this.prisma.order.count({ where: { sellerId: userId, status: 'PENDING' } }),
      this.prisma.order.findMany({
        where: { sellerId: userId, paymentStatus: 'PAID' },
        select: { totalAmount: true },
      }),
      this.prisma.product.count({ where: { shopId: shop.id, isActive: true } }),
      this.prisma.platformSettings.findFirst({ select: { commissionRate: true } }),
      this.prisma.payoutRecord.findMany({ where: { sellerId: userId }, select: { amount: true } }),
    ]);
    const totalRevenue = paidOrders.reduce((s, o) => s + Number(o.totalAmount), 0);
    const platformRate = settings ? Number(settings.commissionRate) / 100 : 0.05;
    const sellerRate = shop.commissionRate != null ? Number(shop.commissionRate) / 100 : platformRate;
    const commission = paidOrders.reduce((s, o) => s + Number(o.totalAmount) * sellerRate, 0);
    const totalPaidToPlatform = payoutRecords.reduce((s, r) => s + Number(r.amount), 0);
    const balance = commission - totalPaidToPlatform;

    return {
      ordersCount,
      pendingOrdersCount,
      totalRevenue: String(totalRevenue),
      productsCount,
      shopSlug: shop.slug,
      commissionRate: shop.commissionRate != null ? Number(shop.commissionRate) : (settings ? Number(settings.commissionRate) : null),
      commission,
      totalPaidToPlatform,
      balance,
    };
  }

  /** Sales by day (PAID orders) for seller chart. Last N days; returns all days in range (zeros for no sales). */
  async getSalesChart(userId: string, days = 30): Promise<{ date: string; total: number; ordersCount: number }[]> {
    const n = Math.min(90, Math.max(1, Number(days) || 30));
    const to = new Date();
    to.setUTCHours(23, 59, 59, 999);
    const from = new Date(to);
    from.setDate(from.getDate() - n);
    from.setUTCHours(0, 0, 0, 0);
    const orders = await this.prisma.order.findMany({
      where: { sellerId: userId, paymentStatus: 'PAID', createdAt: { gte: from, lte: to } },
      select: { totalAmount: true, createdAt: true },
    });
    const byDay = new Map<string, { total: number; ordersCount: number }>();
    for (const o of orders) {
      const d = o.createdAt.toISOString().slice(0, 10);
      const cur = byDay.get(d) ?? { total: 0, ordersCount: 0 };
      cur.total += Number(o.totalAmount);
      cur.ordersCount += 1;
      byDay.set(d, cur);
    }
    const result: { date: string; total: number; ordersCount: number }[] = [];
    const cursor = new Date(from);
    while (cursor <= to) {
      const d = cursor.toISOString().slice(0, 10);
      const v = byDay.get(d) ?? { total: 0, ordersCount: 0 };
      result.push({ date: d, total: v.total, ordersCount: v.ordersCount });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
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
