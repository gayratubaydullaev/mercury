import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  /** Количество купленных единиц товара пользователем (оплаченные, не отменённые заказы). */
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

  /** Сколько отзывов пользователь уже оставил по этому товару. */
  async getReviewCount(productId: string, userId: string): Promise<number> {
    return this.prisma.review.count({ where: { productId, userId } });
  }

  /** Может ли пользователь оставить ещё один отзыв (купил товар и отзывов меньше, чем покупок). */
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

    return this.prisma.review.create({
      data: { productId, userId, rating: r, comment: comment?.trim() || null },
    });
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

  /** Admin: approve or reject review (moderation) */
  async setModerated(id: string, approve: boolean) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    return this.prisma.review.update({ where: { id }, data: { isModerated: approve } });
  }

  /** Only for admin: delete a review by id */
  async remove(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    await this.prisma.review.delete({ where: { id } });
    return { success: true };
  }
}
