import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { UserRole } from '@prisma/client';
import { Request } from 'express';

const VALID_ROLES: UserRole[] = ['ADMIN', 'BUYER', 'SELLER'];

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
  ) {}

  /** Get users in a transaction with RLS context set on the same connection to avoid 500 when using connection pool. */
  async getUsers(req: Request, page = 1, limit = 20, role?: UserRole) {
    const user = req.user as { id: string; role: string } | undefined;
    const userId = user?.id ? String(user.id) : null;
    const roleStr = user?.role ? String(user.role) : null;
    const filterRole = role && VALID_ROLES.includes(role) ? role : undefined;
    const where = filterRole ? { role: filterRole } : {};
    const skip = Math.max(0, (Number(page) || 1) - 1) * Math.max(1, Math.min(100, Number(limit) || 20));
    const take = Math.max(1, Math.min(100, Number(limit) || 20));

    return this.prisma.$transaction(async (tx) => {
      if (userId) await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      if (roleStr) await tx.$executeRaw`SELECT set_config('app.user_role', ${roleStr}, true)`;
      const [data, total] = await Promise.all([
        tx.user.findMany({
          where,
          skip,
          take,
          select: { id: true, email: true, firstName: true, lastName: true, role: true, isBlocked: true, createdAt: true },
        }),
        tx.user.count({ where }),
      ]);
      return { data, total, page: Math.max(1, Number(page) || 1), limit: take, totalPages: Math.ceil(total / take) };
    });
  }

  /** Get one user by id with profile details; for SELLER includes shop and stats. */
  async getUserById(req: Request, id: string) {
    const user = req.user as { id: string; role: string } | undefined;
    const userId = user?.id ? String(user.id) : null;
    const roleStr = user?.role ? String(user.role) : null;

    return this.prisma.$transaction(async (tx) => {
      if (userId) await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      if (roleStr) await tx.$executeRaw`SELECT set_config('app.user_role', ${roleStr}, true)`;
      const u = await tx.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isBlocked: true,
          emailVerified: true,
          avatarUrl: true,
          createdAt: true,
          updatedAt: true,
          shop: { select: { id: true, name: true, slug: true, description: true, isActive: true } },
        },
      });
      if (!u) return null;
      if (u.role !== 'SELLER' || !u.shop) {
        return { ...u, productsCount: 0, ordersCount: 0, totalRevenue: '0' };
      }
      const [productsCount, paidOrders] = await Promise.all([
        tx.product.count({ where: { shopId: u.shop.id } }),
        tx.order.findMany({ where: { sellerId: id, paymentStatus: 'PAID' }, select: { totalAmount: true } }),
      ]);
      const totalRevenue = paidOrders.reduce((s, o) => s + Number(o.totalAmount), 0);
      return {
        ...u,
        productsCount,
        ordersCount: paidOrders.length,
        totalRevenue: String(totalRevenue),
      };
    });
  }

  async blockUser(userId: string, block: boolean) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isBlocked: block },
    });
  }

  async setRole(userId: string, role: UserRole) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
  }

  async getCategories() {
    return this.prisma.category.findMany({
      where: { parentId: null },
      include: { children: { orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(data: { name: string; slug: string; description?: string; parentId?: string }) {
    return this.prisma.category.create({ data });
  }

  async updateCategory(id: string, data: { name?: string; slug?: string; description?: string }) {
    return this.prisma.category.update({ where: { id }, data });
  }

  async deleteCategory(id: string) {
    return this.prisma.category.delete({ where: { id } });
  }

  async getProductsForModeration(page = 1, limit = 20, isModerated?: boolean) {
    const where = isModerated !== undefined ? { isModerated, isActive: true } : { isActive: true };
    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { images: true, category: true, shop: { select: { name: true } } },
      }),
      this.prisma.product.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async moderateProduct(productId: string, approve: boolean) {
    return this.prisma.product.update({
      where: { id: productId },
      data: { isModerated: approve },
    });
  }

  /** Get orders in a transaction with RLS context set on the same connection. */
  async getOrders(req: Request, page = 1, limit = 20) {
    const user = req.user as { id: string; role: string } | undefined;
    const userId = user?.id ? String(user.id) : null;
    const roleStr = user?.role ? String(user.role) : null;
    const skip = Math.max(0, (Number(page) || 1) - 1) * Math.max(1, Math.min(100, Number(limit) || 20));
    const take = Math.max(1, Math.min(100, Number(limit) || 20));

    return this.prisma.$transaction(async (tx) => {
      if (userId) await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      if (roleStr) await tx.$executeRaw`SELECT set_config('app.user_role', ${roleStr}, true)`;
      const [data, total] = await Promise.all([
        tx.order.findMany({
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: { buyer: { select: { firstName: true, lastName: true } }, seller: { select: { firstName: true } }, items: true },
        }),
        tx.order.count(),
      ]);
      return { data, total, page: Math.max(1, Number(page) || 1), limit: take, totalPages: Math.ceil(total / take) };
    });
  }

  async getStats() {
    const [
      usersCount,
      productsCount,
      ordersCount,
      totalRevenue,
      pendingProductsCount,
      pendingReviewsCount,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.product.count({ where: { isActive: true } }),
      this.prisma.order.count(),
      this.prisma.order.aggregate({ _sum: { totalAmount: true }, where: { paymentStatus: 'PAID' } }),
      this.prisma.product.count({ where: { isActive: true, isModerated: false } }),
      this.prisma.review.count({ where: { isModerated: false } }),
    ]);
    return {
      usersCount,
      productsCount,
      ordersCount,
      totalRevenue: totalRevenue._sum.totalAmount?.toString() ?? '0',
      pendingProductsCount,
      pendingReviewsCount,
    };
  }

  async getPlatformSettings() {
    const settings = await this.prisma.platformSettings.findFirst();
    if (!settings) {
      return this.prisma.platformSettings.create({
        data: {
          commissionRate: 5,
          minPayoutAmount: 100000,
          paymentClickEnabled: true,
          paymentPaymeEnabled: true,
          paymentCashEnabled: true,
          paymentCardOnDeliveryEnabled: true,
          deliveryEnabled: true,
          pickupEnabled: true,
        },
      });
    }
    return settings;
  }

  async updatePlatformSettings(data: {
    commissionRate?: number;
    minPayoutAmount?: number;
    paymentClickEnabled?: boolean;
    paymentPaymeEnabled?: boolean;
    paymentCashEnabled?: boolean;
    paymentCardOnDeliveryEnabled?: boolean;
    deliveryEnabled?: boolean;
    pickupEnabled?: boolean;
  }) {
    const settings = await this.prisma.platformSettings.findFirst();
    if (!settings) {
      return this.prisma.platformSettings.create({
        data: {
          commissionRate: data.commissionRate ?? 5,
          minPayoutAmount: data.minPayoutAmount ?? 100000,
          paymentClickEnabled: data.paymentClickEnabled ?? true,
          paymentPaymeEnabled: data.paymentPaymeEnabled ?? true,
          paymentCashEnabled: data.paymentCashEnabled ?? true,
          paymentCardOnDeliveryEnabled: data.paymentCardOnDeliveryEnabled ?? true,
          deliveryEnabled: data.deliveryEnabled ?? true,
          pickupEnabled: data.pickupEnabled ?? true,
        },
      });
    }
    return this.prisma.platformSettings.update({
      where: { id: settings.id },
      data: {
        ...(data.commissionRate != null && { commissionRate: data.commissionRate }),
        ...(data.minPayoutAmount != null && { minPayoutAmount: data.minPayoutAmount }),
        ...(data.paymentClickEnabled != null && { paymentClickEnabled: data.paymentClickEnabled }),
        ...(data.paymentPaymeEnabled != null && { paymentPaymeEnabled: data.paymentPaymeEnabled }),
        ...(data.paymentCashEnabled != null && { paymentCashEnabled: data.paymentCashEnabled }),
        ...(data.paymentCardOnDeliveryEnabled != null && { paymentCardOnDeliveryEnabled: data.paymentCardOnDeliveryEnabled }),
        ...(data.deliveryEnabled != null && { deliveryEnabled: data.deliveryEnabled }),
        ...(data.pickupEnabled != null && { pickupEnabled: data.pickupEnabled }),
      },
    });
  }

  async linkTelegram(code: string): Promise<{ ok: boolean }> {
    const chatId = await this.telegram.resolveLinkCode(code);
    if (!chatId) throw new BadRequestException('Kod notoʻgʻri yoki muddati tugagan. Botda /start yoki /link yuboring.');
    let settings = await this.prisma.platformSettings.findFirst();
    if (!settings) {
      settings = await this.prisma.platformSettings.create({
        data: {
          commissionRate: 5,
          minPayoutAmount: 100000,
          paymentClickEnabled: true,
          paymentPaymeEnabled: true,
          paymentCashEnabled: true,
          paymentCardOnDeliveryEnabled: true,
          deliveryEnabled: true,
          pickupEnabled: true,
        },
      });
    }
    await this.prisma.platformSettings.update({
      where: { id: settings.id },
      data: { adminTelegramChatId: chatId },
    });
    return { ok: true };
  }

  async getTelegramStatus(): Promise<{ connected: boolean }> {
    const settings = await this.prisma.platformSettings.findFirst({
      select: { adminTelegramChatId: true },
    });
    return { connected: !!settings?.adminTelegramChatId };
  }

  async disconnectTelegram(): Promise<{ ok: boolean }> {
    const settings = await this.prisma.platformSettings.findFirst();
    if (!settings) return { ok: true };
    await this.prisma.platformSettings.update({
      where: { id: settings.id },
      data: { adminTelegramChatId: null },
    });
    return { ok: true };
  }

  /** Sellers list with stats (products count, orders count, revenue). Run in transaction with RLS. */
  async getSellers(req: Request, page = 1, limit = 20) {
    const user = req.user as { id: string; role: string } | undefined;
    const userId = user?.id ? String(user.id) : null;
    const roleStr = user?.role ? String(user.role) : null;
    const skip = Math.max(0, (Number(page) || 1) - 1) * Math.max(1, Math.min(100, Number(limit) || 20));
    const take = Math.max(1, Math.min(100, Number(limit) || 20));

    return this.prisma.$transaction(async (tx) => {
      if (userId) await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      if (roleStr) await tx.$executeRaw`SELECT set_config('app.user_role', ${roleStr}, true)`;
      const [sellers, paidOrders, total] = await Promise.all([
        tx.user.findMany({
          where: { role: 'SELLER' },
          skip,
          take,
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isBlocked: true,
            shop: { select: { id: true, name: true, slug: true, commissionRate: true } },
          },
        }),
        tx.order.findMany({
          where: { paymentStatus: 'PAID' },
          select: { sellerId: true, totalAmount: true },
        }),
        tx.user.count({ where: { role: 'SELLER' } }),
      ]);
      const revenueBySeller = new Map<string, { ordersCount: number; totalRevenue: number }>();
      for (const o of paidOrders) {
        const amt = Number(o.totalAmount);
        const cur = revenueBySeller.get(o.sellerId) ?? { ordersCount: 0, totalRevenue: 0 };
        cur.ordersCount += 1;
        cur.totalRevenue += amt;
        revenueBySeller.set(o.sellerId, cur);
      }
      const shopIds = sellers.map((s) => s.shop?.id).filter(Boolean) as string[];
      const productCounts = shopIds.length
        ? await tx.product.groupBy({ by: ['shopId'], _count: true, where: { shopId: { in: shopIds } } })
        : [];
      const countByShop = new Map(productCounts.map((p) => [p.shopId, p._count]));
      const data = sellers.map((s) => {
        const rev = revenueBySeller.get(s.id) ?? { ordersCount: 0, totalRevenue: 0 };
        const productsCount = s.shop ? (countByShop.get(s.shop.id) ?? 0) : 0;
        return {
          id: s.id,
          email: s.email,
          firstName: s.firstName,
          lastName: s.lastName,
          isBlocked: s.isBlocked,
          shop: s.shop,
          productsCount,
          ordersCount: rev.ordersCount,
          totalRevenue: String(rev.totalRevenue),
        };
      });
      return { data, total, page: Math.max(1, Number(page) || 1), limit: take, totalPages: Math.ceil(total / take) };
    });
  }

  /** Payouts by seller (PAID orders). Commission uses seller's shop.commissionRate if set, else platform default. Includes totalPaid and balance. */
  async getPayouts(req: Request, page = 1, limit = 20) {
    const user = req.user as { id: string; role: string } | undefined;
    const userId = user?.id ? String(user.id) : null;
    const roleStr = user?.role ? String(user.role) : null;
    const take = Math.max(1, Math.min(100, Number(limit) || 20));
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (userId) await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
        if (roleStr) await tx.$executeRaw`SELECT set_config('app.user_role', ${roleStr}, true)`;
        const [orders, settings, records] = await Promise.all([
        tx.order.findMany({
          where: { paymentStatus: 'PAID' },
          select: {
            sellerId: true,
            totalAmount: true,
            seller: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                shop: { select: { commissionRate: true } },
              },
            },
          },
        }),
          tx.platformSettings.findFirst(),
          tx.payoutRecord.findMany({ select: { sellerId: true, amount: true } }),
        ]);
        const platformRate = settings ? Number(settings.commissionRate) / 100 : 0.05;
        const bySeller = new Map<string, { seller: { id: string; firstName: string; lastName: string; email: string }; total: number; commission: number; ordersCount: number }>();
        for (const o of orders) {
          const total = Number(o.totalAmount);
          const sellerRate = o.seller.shop?.commissionRate != null ? Number(o.seller.shop.commissionRate) / 100 : platformRate;
          const commission = total * sellerRate;
          const existing = bySeller.get(o.sellerId);
          if (existing) {
            existing.total += total;
            existing.commission += commission;
            existing.ordersCount += 1;
          } else {
            bySeller.set(o.sellerId, {
              seller: { id: o.seller.id, firstName: o.seller.firstName, lastName: o.seller.lastName, email: o.seller.email },
              total,
              commission,
              ordersCount: 1,
            });
          }
        }
        const totalPaidBySeller = new Map<string, number>();
        for (const r of records) {
          totalPaidBySeller.set(r.sellerId, (totalPaidBySeller.get(r.sellerId) ?? 0) + Number(r.amount));
        }
        const list = Array.from(bySeller.entries()).map(([sid, row]) => ({
          ...row,
          totalPaid: totalPaidBySeller.get(sid) ?? 0,
          balance: row.commission - (totalPaidBySeller.get(sid) ?? 0),
        }));
        return {
          data: list.slice(skip, skip + take),
          total: list.length,
          page: Math.max(1, Number(page) || 1),
          limit: take,
          totalPages: Math.ceil(list.length / take),
        };
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`getPayouts failed: ${msg}`, err instanceof Error ? err.stack : undefined);
      if (/payout_records|commission_rate|does not exist|relation.*does not exist/i.test(msg)) {
        throw new HttpException(
          'Toʻlovlar uchun migratsiya kerak. apps/api da: pnpm exec prisma migrate deploy',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      throw new HttpException(
        { message: 'Toʻlovlar roʻyxati olinmadi', error: msg },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Admin records payment received from seller (e.g. cash). */
  async recordPayout(sellerId: string, amount: number, method: string, paidAt?: Date, note?: string) {
    return this.prisma.payoutRecord.create({
      data: {
        sellerId,
        amount,
        method: method || 'CASH',
        paidAt: paidAt ?? new Date(),
        note: note ?? null,
      },
    });
  }

  /** Set commission rate for a seller's shop (individual). Null = use platform default. */
  async setSellerCommissionRate(sellerId: string, commissionRate: number | null) {
    const shop = await this.prisma.shop.findUnique({ where: { userId: sellerId } });
    if (!shop) throw new Error('Shop not found for this seller');
    return this.prisma.shop.update({
      where: { id: shop.id },
      data: commissionRate === null ? { commissionRate: null } : { commissionRate },
    });
  }

  async getBanners() {
    return this.prisma.banner.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createBanner(data: { image: string; href: string; external?: boolean; title?: string; sortOrder?: number }) {
    return this.prisma.banner.create({
      data: {
        image: data.image,
        href: data.href,
        external: data.external ?? false,
        title: data.title ?? null,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async updateBanner(id: string, data: { image?: string; href?: string; external?: boolean; title?: string; sortOrder?: number; isActive?: boolean }) {
    return this.prisma.banner.update({
      where: { id },
      data: {
        ...(data.image != null && { image: data.image }),
        ...(data.href != null && { href: data.href }),
        ...(data.external != null && { external: data.external }),
        ...(data.title != null && { title: data.title }),
        ...(data.sortOrder != null && { sortOrder: data.sortOrder }),
        ...(data.isActive != null && { isActive: data.isActive }),
      },
    });
  }

  async deleteBanner(id: string) {
    return this.prisma.banner.delete({ where: { id } });
  }

  /** List all reviews for admin (with product and user info); optional filter by isModerated */
  async getReviews(page = 1, limit = 20, isModerated?: boolean) {
    const skip = Math.max(0, (Number(page) || 1) - 1) * Math.max(1, Math.min(100, Number(limit) || 20));
    const take = Math.max(1, Math.min(100, Number(limit) || 20));
    const where = isModerated !== undefined ? { isModerated } : {};
    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          product: { select: { id: true, title: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);
    return { data, total, page: Math.max(1, Number(page) || 1), limit: take, totalPages: Math.ceil(total / take) };
  }
}
