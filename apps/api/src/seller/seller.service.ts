import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SellerService {
  constructor(private prisma: PrismaService) {}

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
