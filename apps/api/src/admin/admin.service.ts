import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { BannersService } from '../banners/banners.service';
import { Prisma, UserRole } from '@prisma/client';
import { Request } from 'express';

const VALID_ROLES: UserRole[] = ['ADMIN', 'ADMIN_MODERATOR', 'BUYER', 'SELLER'];

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
    private banners: BannersService,
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
          orderBy: { createdAt: 'desc' },
          select: { id: true, email: true, firstName: true, lastName: true, role: true, isBlocked: true, createdAt: true, moderatorPermissions: true },
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
          moderatorPermissions: true,
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

  async blockUser(userId: string, block: boolean, callerId: string) {
    if (userId === callerId && block) {
      throw new BadRequestException('O‘zingizni bloklay olmaysiz.');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { isBlocked: block },
    });
  }

  async setRole(userId: string, role: UserRole, callerId: string, callerRole: UserRole) {
    if (callerRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Faqat bosh admin foydalanuvchi rolini o‘zgartirishi mumkin.');
    }
    if (!VALID_ROLES.includes(role)) {
      throw new BadRequestException('Noto‘g‘ri rol.');
    }
    if (userId === callerId && role !== UserRole.ADMIN) {
      throw new BadRequestException('O‘zingizga bosh admindan boshqa rol berib bo‘lmaydi (tizimdan chiqib ketasiz).');
    }
    const data: { role: UserRole; moderatorPermissions?: typeof Prisma.JsonNull } = { role };
    if (role !== UserRole.ADMIN_MODERATOR) {
      data.moderatorPermissions = Prisma.JsonNull;
    }
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  /** Set moderator permissions (only for users with role ADMIN_MODERATOR). Main admin only. */
  async setModeratorPermissions(
    userId: string,
    callerRole: UserRole,
    permissions: { canModerateProducts?: boolean; canModerateReviews?: boolean; canApproveSellerApplications?: boolean; canApproveShopUpdates?: boolean },
  ) {
    if (callerRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Faqat bosh admin moderator huquqlarini o‘zgartirishi mumkin.');
    }
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, moderatorPermissions: true },
    });
    if (!target || target.role !== UserRole.ADMIN_MODERATOR) {
      throw new BadRequestException('Faqat moderator rolidagi foydalanuvchiga huquqlar beriladi.');
    }
    const current = (target.moderatorPermissions as Record<string, boolean> | null) ?? {};
    const data = (permissions as Record<string, unknown>) ?? {};
    const keys: (keyof typeof permissions)[] = ['canModerateProducts', 'canModerateReviews', 'canApproveSellerApplications', 'canApproveShopUpdates'];
    const merged = { ...current } as Record<string, boolean>;
    for (const k of keys) {
      if (data[k] === true || data[k] === false) merged[k] = data[k] as boolean;
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { moderatorPermissions: Object.keys(merged).length > 0 ? merged : Prisma.JsonNull },
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
      paidOrdersCount,
      totalRevenue,
      pendingProductsCount,
      pendingReviewsCount,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.product.count({ where: { isActive: true } }),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { paymentStatus: 'PAID' } }),
      this.prisma.order.aggregate({ _sum: { totalAmount: true }, where: { paymentStatus: 'PAID' } }),
      this.prisma.product.count({ where: { isActive: true, isModerated: false } }),
      this.prisma.review.count({ where: { isModerated: false } }),
    ]);
    return {
      usersCount,
      productsCount,
      ordersCount,
      paidOrdersCount,
      totalRevenue: totalRevenue._sum.totalAmount?.toString() ?? '0',
      pendingProductsCount,
      pendingReviewsCount,
    };
  }

  /** Sales by day (PAID orders) for chart. Last N days; returns all days in range (zeros for no sales). */
  async getSalesChart(days = 30): Promise<{ date: string; total: number; ordersCount: number }[]> {
    const n = Math.min(90, Math.max(1, Number(days) || 30));
    const to = new Date();
    to.setUTCHours(23, 59, 59, 999);
    const from = new Date(to);
    from.setDate(from.getDate() - n);
    from.setUTCHours(0, 0, 0, 0);
    const orders = await this.prisma.order.findMany({
      where: { paymentStatus: 'PAID', createdAt: { gte: from, lte: to } },
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
          chatWithSellerEnabled: true,
        },
      });
    }
    return settings;
  }

  async updatePlatformSettings(data: {
    siteName?: string | null;
    commissionRate?: number;
    minPayoutAmount?: number;
    paymentClickEnabled?: boolean;
    paymentPaymeEnabled?: boolean;
    paymentCashEnabled?: boolean;
    paymentCardOnDeliveryEnabled?: boolean;
    deliveryEnabled?: boolean;
    pickupEnabled?: boolean;
    chatWithSellerEnabled?: boolean;
    adminTelegramChatId?: string | null;
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
          chatWithSellerEnabled: data.chatWithSellerEnabled ?? true,
        },
      });
    }
    return this.prisma.platformSettings.update({
      where: { id: settings.id },
      data: {
        ...(data.siteName !== undefined && { siteName: data.siteName?.trim() || null }),
        ...(data.commissionRate != null && { commissionRate: data.commissionRate }),
        ...(data.minPayoutAmount != null && { minPayoutAmount: data.minPayoutAmount }),
        ...(data.paymentClickEnabled != null && { paymentClickEnabled: data.paymentClickEnabled }),
        ...(data.paymentPaymeEnabled != null && { paymentPaymeEnabled: data.paymentPaymeEnabled }),
        ...(data.paymentCashEnabled != null && { paymentCashEnabled: data.paymentCashEnabled }),
        ...(data.paymentCardOnDeliveryEnabled != null && { paymentCardOnDeliveryEnabled: data.paymentCardOnDeliveryEnabled }),
        ...(data.deliveryEnabled != null && { deliveryEnabled: data.deliveryEnabled }),
        ...(data.pickupEnabled != null && { pickupEnabled: data.pickupEnabled }),
        ...(data.chatWithSellerEnabled != null && { chatWithSellerEnabled: data.chatWithSellerEnabled }),
        ...(data.adminTelegramChatId !== undefined && {
          adminTelegramChatId: data.adminTelegramChatId?.trim() || null,
        }),
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
          chatWithSellerEnabled: true,
        },
      });
    }
    await this.prisma.platformSettings.update({
      where: { id: settings.id },
      data: { adminTelegramChatId: chatId },
    });
    return { ok: true };
  }

  async getTelegramStatus(): Promise<{ connected: boolean; adminTelegramChatId?: string | null }> {
    const chatId = await this.telegram.getAdminChatId();
    return { connected: !!chatId, adminTelegramChatId: chatId ?? null };
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

  /**
   * Commission accounting by seller. Buyer pays seller directly (cash/card on receipt).
   * We track: sales (order total), our commission (platform %), amount seller has paid to us (cash/card), balance = commission - paid.
   */
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
        // balance = commission - totalPaid. If seller paid in cash/card more than commission, balance < 0 (seller credit).
        const list = Array.from(bySeller.entries()).map(([sid, row]) => {
          const totalPaid = totalPaidBySeller.get(sid) ?? 0;
          const balance = row.commission - totalPaid;
          return { ...row, totalPaid, balance };
        });
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

  /** Admin records payment received from seller (cash/card). Reduces commission balance. If amount > commission, balance becomes negative (seller credit for next period). */
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

  async createBanner(data: {
    image: string;
    href: string;
    external?: boolean;
    title?: string;
    sortOrder?: number;
    displaySeconds?: number;
    startsAt?: string;
    endsAt?: string;
  }) {
    const result = await this.prisma.banner.create({
      data: {
        image: data.image,
        href: data.href,
        external: data.external ?? false,
        title: data.title ?? null,
        sortOrder: data.sortOrder ?? 0,
        displaySeconds: data.displaySeconds ?? null,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
      },
    });
    await this.banners.invalidateCache();
    return result;
  }

  async updateBanner(
    id: string,
    data: {
      image?: string;
      href?: string;
      external?: boolean;
      title?: string;
      sortOrder?: number;
      isActive?: boolean;
      displaySeconds?: number | null;
      startsAt?: string | null;
      endsAt?: string | null;
    },
  ) {
    const result = await this.prisma.banner.update({
      where: { id },
      data: {
        ...(data.image != null && { image: data.image }),
        ...(data.href != null && { href: data.href }),
        ...(data.external != null && { external: data.external }),
        ...(data.title != null && { title: data.title }),
        ...(data.sortOrder != null && { sortOrder: data.sortOrder }),
        ...(data.isActive != null && { isActive: data.isActive }),
        ...(data.displaySeconds !== undefined && { displaySeconds: data.displaySeconds }),
        ...(data.startsAt !== undefined && { startsAt: data.startsAt ? new Date(data.startsAt) : null }),
        ...(data.endsAt !== undefined && { endsAt: data.endsAt ? new Date(data.endsAt) : null }),
      },
    });
    await this.banners.invalidateCache();
    return result;
  }

  async deleteBanner(id: string) {
    const result = await this.prisma.banner.delete({ where: { id } });
    await this.banners.invalidateCache();
    return result;
  }

  /** Заявки на продавца: список с фильтром по status (PENDING | APPROVED | REJECTED). */
  async getSellerApplications(page = 1, limit = 20, status?: string) {
    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Math.min(50, Number(limit) || 20));
    const take = Math.max(1, Math.min(50, Number(limit) || 20));
    const where = status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status) ? { status } : {};
    const [data, total] = await Promise.all([
      this.prisma.sellerApplication.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.sellerApplication.count({ where }),
    ]);
    return { data, total, page: Math.max(1, Number(page)), limit: take, totalPages: Math.ceil(total / take) };
  }

  /** Одобрить заявку: создать Shop, выставить role = SELLER. */
  async approveSellerApplication(applicationId: string, adminUserId: string) {
    const app = await this.prisma.sellerApplication.findUnique({
      where: { id: applicationId },
      include: { user: true },
    });
    if (!app) throw new BadRequestException('Ariza topilmadi.');
    if (app.status !== 'PENDING') throw new BadRequestException('Ariza allaqachon ko‘rib chiqilgan.');
    let slug = app.shopName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'shop';
    const existing = await this.prisma.shop.findUnique({ where: { slug } });
    if (existing) {
      let suffix = 1;
      while (await this.prisma.shop.findUnique({ where: { slug: `${slug}-${suffix}` } })) suffix += 1;
      slug = `${slug}-${suffix}`;
    }
    const appAny = app as { legalType?: string | null; legalName?: string | null; ogrn?: string | null; inn?: string | null; documentUrls?: string[] | null };
    await this.prisma.$transaction(async (tx) => {
      await tx.shop.create({
        data: {
          userId: app.userId,
          name: app.shopName,
          slug,
          description: app.description ?? null,
          legalType: appAny.legalType ?? undefined,
          legalName: appAny.legalName ?? undefined,
          ogrn: appAny.ogrn ?? undefined,
          inn: appAny.inn ?? undefined,
          documentUrls: Array.isArray(appAny.documentUrls) ? appAny.documentUrls : undefined,
        },
      });
      await tx.user.update({
        where: { id: app.userId },
        data: { role: 'SELLER' },
      });
      await tx.sellerApplication.update({
        where: { id: applicationId },
        data: { status: 'APPROVED', reviewedAt: new Date(), reviewedById: adminUserId },
      });
    });
    return { ok: true, message: 'Ariza qabul qilindi. Foydalanuvchi endi sotuvchi.' };
  }

  /** Отклонить заявку. */
  async rejectSellerApplication(applicationId: string, adminUserId: string, rejectReason?: string) {
    const app = await this.prisma.sellerApplication.findUnique({ where: { id: applicationId } });
    if (!app) throw new BadRequestException('Ariza topilmadi.');
    if (app.status !== 'PENDING') throw new BadRequestException('Ariza allaqachon ko‘rib chiqilgan.');
    await this.prisma.sellerApplication.update({
      where: { id: applicationId },
      data: { status: 'REJECTED', rejectReason: rejectReason ?? null, reviewedAt: new Date(), reviewedById: adminUserId },
    });
    return { ok: true, message: 'Ariza rad etildi.' };
  }

  /** Список запросов на изменение данных магазина (ожидают одобрения). */
  async getPendingShopUpdates(page = 1, limit = 20) {
    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Math.min(50, Number(limit) || 20));
    const take = Math.max(1, Math.min(50, Number(limit) || 20));
    const [data, total] = await Promise.all([
      this.prisma.pendingShopUpdate.findMany({
        where: { status: 'PENDING' },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { shop: { select: { id: true, name: true, slug: true, userId: true, user: { select: { email: true, firstName: true, lastName: true } } } } },
      }),
      this.prisma.pendingShopUpdate.count({ where: { status: 'PENDING' } }),
    ]);
    return { data, total, page: Math.max(1, Number(page)), limit: take, totalPages: Math.ceil(total / take) };
  }

  /** Одобрить изменение данных магазина: применить requested* к Shop. */
  async approvePendingShopUpdate(pendingId: string, adminUserId: string) {
    const pending = await this.prisma.pendingShopUpdate.findUnique({
      where: { id: pendingId },
      include: { shop: true },
    });
    if (!pending) throw new BadRequestException('So‘rov topilmadi.');
    if (pending.status !== 'PENDING') throw new BadRequestException('So‘rov allaqachon ko‘rib chiqilgan.');
    const slugExists = await this.prisma.shop.findFirst({
      where: { slug: pending.requestedSlug, id: { not: pending.shopId } },
    });
    if (slugExists) throw new BadRequestException(`Slug "${pending.requestedSlug}" allaqachon band.`);
    const pendingAny = pending as {
      requestedLegalType?: string | null;
      requestedLegalName?: string | null;
      requestedOgrn?: string | null;
      requestedInn?: string | null;
      requestedDocumentUrls?: string[] | null;
    };
    await this.prisma.$transaction(async (tx) => {
      await tx.shop.update({
        where: { id: pending.shopId },
        data: {
          name: pending.requestedName,
          slug: pending.requestedSlug,
          description: pending.requestedDescription ?? undefined,
          legalType: pendingAny.requestedLegalType ?? undefined,
          legalName: pendingAny.requestedLegalName ?? undefined,
          ogrn: pendingAny.requestedOgrn ?? undefined,
          inn: pendingAny.requestedInn ?? undefined,
          documentUrls: pendingAny.requestedDocumentUrls ?? undefined,
        },
      });
      await tx.pendingShopUpdate.update({
        where: { id: pendingId },
        data: { status: 'APPROVED', reviewedAt: new Date(), reviewedById: adminUserId },
      });
    });
    return { ok: true, message: 'O‘zgarishlar qabul qilindi.' };
  }

  /** Отклонить изменение данных магазина. */
  async rejectPendingShopUpdate(pendingId: string, adminUserId: string, rejectReason?: string) {
    const pending = await this.prisma.pendingShopUpdate.findUnique({ where: { id: pendingId } });
    if (!pending) throw new BadRequestException('So‘rov topilmadi.');
    if (pending.status !== 'PENDING') throw new BadRequestException('So‘rov allaqachon ko‘rib chiqilgan.');
    await this.prisma.pendingShopUpdate.update({
      where: { id: pendingId },
      data: { status: 'REJECTED', rejectReason: rejectReason ?? null, reviewedAt: new Date(), reviewedById: adminUserId },
    });
    return { ok: true, message: 'So‘rov rad etildi.' };
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
