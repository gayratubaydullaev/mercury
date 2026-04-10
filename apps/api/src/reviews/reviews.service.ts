import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { getPlatformMarketplaceMode } from '../common/platform-settings-compat';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MarketplaceMode, OrderStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
    private notifications: NotificationsService,
  ) {}
  async getPurchasedQuantity(productId: string, userId: string): Promise<number> {
    const agg = await this.prisma.orderItem.aggregate({
      where: {
        productId,
        order: {
          buyerId: userId,
          status: { not: OrderStatus.CANCELLED },
          paymentStatus: PaymentStatus.PAID,
        },
      },
      _sum: { quantity: true },
    });
    return agg._sum.quantity ?? 0;
  }

  async getReviewCount(productId: string, userId: string): Promise<number> {
    return this.prisma.review.count({ where: { productId, userId } });
  }

  async canLeaveReview(productId: string, userId: string): Promise<{ canReview: boolean; purchaseCount: number; reviewCount: number }> {
    const [purchaseCount, reviewCount] = await Promise.all([
      this.getPurchasedQuantity(productId, userId),
      this.getReviewCount(productId, userId),
    ]);
    return { canReview: purchaseCount > reviewCount, purchaseCount, reviewCount };
  }

  async create(productId: string, userId: string, rating: number, comment?: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    const r = Math.round(Number(rating));
    if (r < 1 || r > 5) throw new BadRequestException('Rating must be between 1 and 5');

    const { canReview, purchaseCount, reviewCount } = await this.canLeaveReview(productId, userId);
    if (!canReview) {
      if (purchaseCount === 0) {
        throw new ForbiddenException('Sharh yozish uchun avval ushbu mahsulotni sotib olishingiz kerak.');
      }
      throw new ForbiddenException(
        `Siz ushbu mahsulot boʻyicha ${reviewCount} ta sharh yozgansiz (sotib olganlar: ${purchaseCount}). Qoʻshimcha sharh yozish uchun mahsulotni qayta sotib oling.`,
      );
    }

    const marketplaceMode = await getPlatformMarketplaceMode(this.prisma);
    const instantReview = marketplaceMode === MarketplaceMode.SINGLE_SHOP;

    const created = await this.prisma.review.create({
      data: {
        productId,
        userId,
        rating: r,
        comment: comment?.trim() || null,
        isModerated: instantReview,
      },
    });
    const full = await this.prisma.review.findUnique({
      where: { id: created.id },
      include: { product: { include: { shop: true } }, user: { select: { firstName: true, lastName: true } } },
    });
    if (full) {
      const sellerId = full.product.shop.userId;
      this.telegram
        .sendSellerReviewNotification(sellerId, {
          rating: full.rating,
          comment: full.comment,
          productTitle: full.product.title,
          userName: `${full.user.firstName} ${full.user.lastName}`,
        })
        .catch(() => {});
      this.notifications
        .createForUser(sellerId, {
          type: 'NEW_REVIEW',
          title: 'Yangi sharh',
          body: `${full.product.title} — ${full.rating} yulduz`,
          link: `/seller/reviews`,
          entityId: full.id,
        })
        .catch(() => {});
      if (!instantReview) {
        this.telegram
          .sendAdminPendingReviewNotification({
            id: full.id,
            rating: full.rating,
            comment: full.comment,
            productTitle: full.product.title,
            userName: `${full.user.firstName} ${full.user.lastName}`,
          })
          .catch(() => {});
      }
    }
    return created;
  }

  async getForProduct(productId: string) {
    return this.prisma.review.findMany({
      where: { productId, isModerated: true },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async sellerReply(reviewId: string, sellerId: string, reply: string) {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId },
      include: { product: { include: { shop: true } } },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.product.shop.userId !== sellerId) throw new ForbiddenException();
    const text = typeof reply === 'string' ? reply.trim() : '';
    return this.prisma.review.update({ where: { id: reviewId }, data: { sellerReply: text || null } });
  }

  async setModerated(id: string, approve: boolean) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    return this.prisma.review.update({ where: { id }, data: { isModerated: approve } });
  }

  async remove(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    await this.prisma.review.delete({ where: { id } });
    return { success: true };
  }
}
