import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { CreateOrderDto, DeliveryType } from './dto/create-order.dto';
import { OrderStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
  ) {}

  private async generateOrderNumber() {
    const count = await this.prisma.order.count();
    return `ORD-${Date.now().toString(36).toUpperCase()}-${(count + 1).toString().padStart(5, '0')}`;
  }

  async create(buyerId: string | null, sessionId: string | null, dto: CreateOrderDto) {
    const isGuest = !buyerId;
    const deliveryType: DeliveryType = dto.deliveryType ?? DeliveryType.DELIVERY;
    if (isGuest && !dto.guestPhone?.trim()) {
      throw new BadRequestException('Guest order requires guestPhone');
    }
    if (isGuest && !sessionId) throw new BadRequestException('Cart session required for guest order');
    if (deliveryType === DeliveryType.DELIVERY && !dto.shippingAddress) {
      throw new BadRequestException('Shipping address required for delivery');
    }

    const cart = isGuest
      ? await this.prisma.cart.findFirst({
          where: { sessionId },
          include: { items: { include: { product: { include: { shop: true } }, variant: true } } },
        })
      : await this.prisma.cart.findFirst({
          where: { userId: buyerId },
          include: { items: { include: { product: { include: { shop: true } }, variant: true } } },
        });
    if (!cart || !cart.items.length) throw new BadRequestException('Cart is empty');

    // Validate stock before creating order — prevent checkout when product is out of stock
    const outOfStockMessages: string[] = [];
    for (const item of cart.items) {
      const available = item.variantId && item.variant
        ? item.variant.stock
        : item.product.stock;
      if (available < item.quantity) {
        const need = item.quantity;
        outOfStockMessages.push(
          `"${item.product.title}": ${need} ta soʻralgan, mavjud ${available} ta`,
        );
      }
    }
    if (outOfStockMessages.length > 0) {
      throw new BadRequestException({
        message: 'Baʼzi mahsulotlar yetarli miqdorda mavjud emas. Savatni yangilang.',
        outOfStock: outOfStockMessages,
      });
    }

    const byShop = new Map<string, typeof cart.items>();
    for (const item of cart.items) {
      const shopId = item.product.shopId;
      if (!byShop.has(shopId)) byShop.set(shopId, []);
      byShop.get(shopId)!.push(item);
    }

    const orders = [];
    const shippingPayload = deliveryType === DeliveryType.PICKUP
      ? (dto.shippingAddress && typeof dto.shippingAddress === 'object' ? dto.shippingAddress : {})
      : (dto.shippingAddress as object);
    for (const [, items] of byShop) {
      const orderNumber = await this.generateOrderNumber();
      const sellerId = items[0]!.product.shop.userId;
      const totalAmount = items.reduce((sum, i) => {
        const price = i.variant?.priceOverride != null ? Number(i.variant.priceOverride) : Number(i.product.price);
        return sum + price * i.quantity;
      }, 0);
      const guestViewToken = isGuest ? randomBytes(24).toString('hex') : undefined;
      const order = await this.prisma.order.create({
        data: {
          orderNumber,
          ...(buyerId != null ? { buyerId } : {}),
          ...(isGuest ? { guestEmail: dto.guestEmail?.trim(), guestPhone: dto.guestPhone?.trim(), guestViewToken } : {}),
          sellerId,
          paymentMethod: dto.paymentMethod,
          deliveryType,
          totalAmount: new Decimal(totalAmount),
          shippingAddress: shippingPayload,
          notes: dto.notes,
          items: {
            create: items.map((i) => {
              const price = i.variant?.priceOverride != null ? i.variant.priceOverride! : i.product.price;
              return {
                productId: i.productId,
                variantId: i.variantId ?? undefined,
                quantity: i.quantity,
                price,
              };
            }),
          },
        },
        include: {
          items: { include: { product: { include: { images: true, shop: true } }, variant: true } as const },
          seller: { include: { shop: true } },
          buyer: { select: { firstName: true, lastName: true, email: true, phone: true } },
        },
      });
      orders.push(order);
      this.telegram.sendOrderNotification(order.sellerId, order, 'new_order').catch(() => {});
      this.telegram.sendAdminOrderNotification(order, 'new_order').catch(() => {});
      if (order.buyerId) {
        this.telegram.sendBuyerOrderNotification(order.buyerId, order, 'new_order').catch(() => {});
      }
    }
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    this.logger.log(`Orders created: ${orders.map((o) => o.id).join(', ')} for ${buyerId ?? 'guest'}`);
    return orders;
  }

  async findMyOrders(buyerId: string, page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { buyerId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { product: { include: { images: true } } } }, seller: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.order.count({ where: { buyerId } }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findSellerOrders(sellerId: string, page = 1, limit = 20, status?: OrderStatus) {
    const where: { sellerId: string; status?: OrderStatus } = { sellerId };
    if (status) where.status = status;
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { product: true } }, buyer: { select: { firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, userId: string, role: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, buyer: true, seller: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    const canAccess = order.buyerId === userId || order.sellerId === userId || role === 'ADMIN';
    if (!canAccess) throw new ForbiddenException();
    return order;
  }

  /** Normalize phone for lookup: digits only (e.g. 998901234567). */
  private normalizePhone(phone: string): string {
    return (phone || '').replace(/\D/g, '');
  }

  /** Get guest order by order number + phone (public). For guests who lost the view link. */
  async findGuestOrderByNumberAndPhone(orderNumber: string, guestPhone: string) {
    const phone = this.normalizePhone(guestPhone ?? '');
    if (!orderNumber?.trim() || !phone) throw new NotFoundException('Order not found');
    const order = await this.prisma.order.findFirst({
      where: {
        orderNumber: orderNumber.trim(),
        buyerId: null,
        guestPhone: { not: null },
      },
      include: {
        items: { include: { product: { include: { images: true, shop: true } }, variant: true } },
        seller: { include: { shop: true } },
      },
    });
    if (!order || this.normalizePhone(order.guestPhone ?? '') !== phone) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  /** Get order by id + guest view token (public, for guests to view their order after checkout). */
  async findOneByGuestToken(id: string, token: string) {
    if (!token?.trim()) throw new NotFoundException('Order not found');
    const order = await this.prisma.order.findFirst({
      where: { id, guestViewToken: token.trim() },
      include: {
        items: { include: { product: { include: { images: true, shop: true } }, variant: true } },
        seller: { include: { shop: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateStatus(id: string, sellerId: string, status: OrderStatus) {
    const order = await this.prisma.order.findFirst({ where: { id, sellerId } });
    if (!order) throw new NotFoundException('Order not found');
    const updated = await this.prisma.order.update({
      where: { id },
      data: { status },
      include: {
        items: { include: { product: { select: { title: true } }, variant: { select: { options: true } } } as const },
        buyer: { select: { firstName: true, lastName: true, email: true, phone: true } },
        seller: { select: { firstName: true, lastName: true, shop: { select: { name: true } } } },
      },
    });
    this.telegram.sendOrderNotification(sellerId, updated, 'status_updated', status).catch(() => {});
    this.telegram.sendAdminOrderNotification(updated, 'status_updated', status).catch(() => {});
    if (updated.buyerId) {
      this.telegram.sendBuyerOrderNotification(updated.buyerId, updated, 'status_updated', status).catch(() => {});
    }
    return updated;
  }
}
