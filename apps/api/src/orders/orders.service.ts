import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOrderDto, DeliveryType } from './dto/create-order.dto';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
    private notifications: NotificationsService,
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
      this.appendOrderAudit(order.id, order.buyerId ?? null, 'ORDER_CREATED', {
        source: 'cart',
        paymentMethod: dto.paymentMethod,
        deliveryType,
        orderNumber: order.orderNumber,
      });
      orders.push(order);
      this.telegram.sendOrderNotification(order.sellerId, order, 'new_order').catch(() => {});
      this.telegram.sendAdminOrderNotification(order, 'new_order').catch(() => {});
      if (order.buyerId) {
        this.telegram.sendBuyerOrderNotification(order.buyerId, order, 'new_order').catch(() => {});
      }
      this.notifications
        .createForUser(order.sellerId, {
          type: 'NEW_ORDER',
          title: 'Yangi buyurtma',
          body: `${order.orderNumber} — ${Number(order.totalAmount).toLocaleString()} soʻm`,
          link: '/seller/orders',
          entityId: order.id,
        })
        .catch(() => {});
    }
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    this.logger.log(`Orders created: ${orders.map((o) => o.id).join(', ')} for ${buyerId ?? 'guest'}`);
    return orders;
  }

  async createOrderFromCheckoutSession(
    sessionId: string,
    provider: 'CLICK' | 'PAYME',
    externalId: string,
  ) {
    const session = await this.prisma.checkoutSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Checkout session not found');
    if (session.orderId) {
      const existing = await this.prisma.order.findUnique({
        where: { id: session.orderId },
        include: {
          items: { include: { product: { include: { images: true, shop: true } }, variant: true } },
          seller: { include: { shop: true } },
          buyer: { select: { firstName: true, lastName: true, email: true, phone: true } },
        },
      });
      return existing!;
    }
    const cartSnapshot = session.cartSnapshot as Array<{ productId: string; variantId?: string; quantity: number; price: number; sellerId: string }>;
    if (!Array.isArray(cartSnapshot) || cartSnapshot.length === 0) throw new BadRequestException('Invalid session cart');

    const sellerId = cartSnapshot[0]!.sellerId;
    for (const item of cartSnapshot) {
      const stock = item.variantId
        ? (await this.prisma.productVariant.findUnique({ where: { id: item.variantId }, select: { stock: true } }))?.stock ?? 0
        : (await this.prisma.product.findUnique({ where: { id: item.productId }, select: { stock: true, title: true } }))?.stock ?? 0;
      const productTitle = (await this.prisma.product.findUnique({ where: { id: item.productId }, select: { title: true } }))?.title ?? item.productId;
      if (stock < item.quantity) {
        throw new BadRequestException(`Mahsulot yetarli emas: ${productTitle}`);
      }
    }

    const orderNumber = await this.generateOrderNumber();
    const totalAmount = cartSnapshot.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const order = await this.prisma.$transaction(async (tx) => {
      const o = await tx.order.create({
        data: {
          orderNumber,
          buyerId: session.buyerId!,
          sellerId,
          paymentMethod: session.paymentMethod as 'CLICK' | 'PAYME',
          paymentStatus: 'PAID',
          status: 'CONFIRMED',
          deliveryType: session.deliveryType as 'DELIVERY' | 'PICKUP',
          totalAmount: new Decimal(totalAmount),
          shippingAddress: session.shippingAddress as object,
          notes: session.notes ?? undefined,
          items: {
            create: cartSnapshot.map((i) => ({
              productId: i.productId,
              variantId: i.variantId ?? undefined,
              quantity: i.quantity,
              price: new Decimal(i.price),
            })),
          },
        },
        include: {
          items: { include: { product: { include: { images: true, shop: true } }, variant: true } },
          seller: { include: { shop: true } },
          buyer: { select: { firstName: true, lastName: true, email: true, phone: true } },
        },
      });
      await tx.payment.create({
        data: { orderId: o.id, provider, amount: new Decimal(totalAmount), status: 'PAID', externalId },
      });
      await tx.checkoutSession.update({ where: { id: sessionId }, data: { orderId: o.id } });
      const cart = await tx.cart.findFirst({ where: { userId: session.buyerId! } });
      if (cart) await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return o;
    });

    this.telegram.sendOrderNotification(order.sellerId, order, 'new_order').catch(() => {});
    this.telegram.sendAdminOrderNotification(order, 'new_order').catch(() => {});
    this.telegram.sendBuyerOrderNotification(order.buyerId!, order, 'new_order').catch(() => {});
    this.notifications
      .createForUser(order.sellerId, {
        type: 'NEW_ORDER',
        title: 'Yangi buyurtma',
        body: `${order.orderNumber} — ${Number(order.totalAmount).toLocaleString()} soʻm`,
        link: '/seller/orders',
        entityId: order.id,
      })
      .catch(() => {});
    this.appendOrderAudit(order.id, order.buyerId, 'ORDER_CREATED', {
      source: 'checkout_session',
      provider,
      paymentMethod: session.paymentMethod,
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
      orderNumber: order.orderNumber,
      externalId,
    });
    this.logger.log(`Order created from checkout session ${sessionId}: ${order.id}`);
    return order;
  }

  async findMyOrders(buyerId: string, page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { buyerId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { product: { include: { images: true } } } },
          seller: { select: { firstName: true, lastName: true, shop: { select: { name: true, pickupAddress: true } } } },
        },
      }),
      this.prisma.order.count({ where: { buyerId } }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findSellerOrders(
    sellerId: string,
    page = 1,
    limit = 20,
    status?: OrderStatus,
    paymentStatus?: PaymentStatus,
    search?: string,
  ) {
    const shop = await this.prisma.shop.findUnique({
      where: { userId: sellerId },
      select: { id: true },
    });
    if (!shop) {
      return { data: [], total: 0, page: 1, limit, totalPages: 0 };
    }
    const where: Prisma.OrderWhereInput = { sellerId };
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    const q = search?.trim();
    if (q) {
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { guestPhone: { contains: q, mode: 'insensitive' } },
        {
          buyer: {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  title: true,
                  price: true,
                  sku: true,
                  unit: true,
                  stock: true,
                  options: true,
                  specs: true,
                },
              },
              variant: {
                select: {
                  id: true,
                  options: true,
                  sku: true,
                  stock: true,
                  priceOverride: true,
                },
              },
            },
          },
          buyer: { select: { firstName: true, lastName: true, email: true, phone: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, userId: string, role: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true, variant: true } },
        buyer: true,
        seller: { include: { shop: { select: { id: true, name: true, slug: true } } } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    const canAccess = order.buyerId === userId || order.sellerId === userId || role === 'ADMIN' || role === 'ADMIN_MODERATOR';
    if (!canAccess) throw new ForbiddenException();
    return order;
  }

  /** Same access as findOne: buyer, seller of order, or platform admin. */
  async getOrderAudit(orderId: string, userId: string, role: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, buyerId: true, sellerId: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    const canAccess = order.buyerId === userId || order.sellerId === userId || role === 'ADMIN' || role === 'ADMIN_MODERATOR';
    if (!canAccess) throw new ForbiddenException();
    return this.prisma.orderAuditEvent.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Fire-and-forget audit row (payment webhooks often use actorUserId null).
   * Exported for PaymentsService and other modules that must not duplicate Prisma writes.
   */
  appendOrderAudit(orderId: string, actorUserId: string | null, action: string, meta: Prisma.InputJsonValue) {
    this.prisma.orderAuditEvent
      .create({
        data: { orderId, actorUserId, action, meta },
      })
      .catch((err) => this.logger.warn(`order audit log failed: ${(err as Error).message}`));
  }

  private normalizePhone(phone: string): string {
    return (phone || '').replace(/\D/g, '');
  }

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
    const isPrepaid = order.paymentMethod === 'CLICK' || order.paymentMethod === 'PAYME';
    if ((status === 'SHIPPED' || status === 'DELIVERED') && isPrepaid && order.paymentStatus !== 'PAID') {
      throw new BadRequestException(
        'Click yoki Payme orqali toʻlov qilinmaguncha «Yuborildi» / «Yetkazildi» belgilab boʻlmaydi. Toʻlovni kuting yoki naqd/karta (yetkazishda) uchun buyurtma qiling.',
      );
    }
    const fromStatus = order.status;
    const updated = await this.prisma.order.update({
      where: { id },
      data: { status },
      include: {
        items: { include: { product: { select: { title: true } }, variant: { select: { options: true } } } as const },
        buyer: { select: { firstName: true, lastName: true, email: true, phone: true } },
        seller: { select: { firstName: true, lastName: true, shop: { select: { name: true } } } },
      },
    });
    this.appendOrderAudit(id, sellerId, 'SELLER_STATUS', { fromStatus, toStatus: status });
    this.telegram.sendOrderNotification(sellerId, updated, 'status_updated', status).catch(() => {});
    this.telegram.sendAdminOrderNotification(updated, 'status_updated', status).catch(() => {});
    if (updated.buyerId) {
      this.telegram.sendBuyerOrderNotification(updated.buyerId, updated, 'status_updated', status).catch(() => {});
    }
    return updated;
  }

  async markAsPaid(id: string, sellerId: string) {
    const order = await this.prisma.order.findFirst({ where: { id, sellerId } });
    if (!order) throw new NotFoundException('Order not found');
    const method = order.paymentMethod;
    if (method !== 'CASH' && method !== 'CARD_ON_DELIVERY') {
      throw new BadRequestException('Toʻlovni faqat naqd yoki karta (yetkazishda) usuli uchun belgilash mumkin.');
    }
    if (order.paymentStatus === 'PAID') {
      return order;
    }
    const updated = await this.prisma.order.update({
      where: { id },
      data: { paymentStatus: 'PAID' },
      include: {
        items: { include: { product: { select: { title: true } }, variant: { select: { options: true } } } as const },
        buyer: { select: { firstName: true, lastName: true, email: true, phone: true } },
        seller: { select: { firstName: true, lastName: true, shop: { select: { name: true } } } },
      },
    });
    this.appendOrderAudit(id, sellerId, 'SELLER_MARK_PAID', { paymentMethod: order.paymentMethod });
    return updated;
  }

  private readonly orderStatusNotifyInclude = {
    items: { include: { product: { select: { title: true } }, variant: { select: { options: true } } } as const },
    buyer: { select: { firstName: true, lastName: true, email: true, phone: true } },
    seller: { select: { firstName: true, lastName: true, shop: { select: { name: true } } } },
  } as const;

  /**
   * Admin console: mass status change (max 100). Same prepaid rules as seller flow.
   */
  async adminBulkSetOrderStatus(
    orderIds: string[],
    status: OrderStatus,
    actorUserId: string,
  ): Promise<{ updated: number; skipped: { id: string; reason: string }[] }> {
    const ids = [...new Set(orderIds)].filter(Boolean).slice(0, 100);
    const skipped: { id: string; reason: string }[] = [];
    let updated = 0;

    for (const id of ids) {
      const order = await this.prisma.order.findUnique({ where: { id } });
      if (!order) {
        skipped.push({ id, reason: 'not_found' });
        continue;
      }
      const isPrepaid = order.paymentMethod === 'CLICK' || order.paymentMethod === 'PAYME';
      if ((status === 'SHIPPED' || status === 'DELIVERED') && isPrepaid && order.paymentStatus !== 'PAID') {
        skipped.push({ id, reason: 'prepaid_unpaid' });
        continue;
      }
      if (order.status === status) {
        skipped.push({ id, reason: 'unchanged' });
        continue;
      }

      const fromStatus = order.status;
      const updatedOrder = await this.prisma.order.update({
        where: { id },
        data: { status },
        include: this.orderStatusNotifyInclude,
      });
      updated += 1;

      this.appendOrderAudit(id, actorUserId, 'ADMIN_BULK_STATUS', { fromStatus, toStatus: status });

      this.telegram.sendOrderNotification(updatedOrder.sellerId, updatedOrder, 'status_updated', status).catch(() => {});
      this.telegram.sendAdminOrderNotification(updatedOrder, 'status_updated', status).catch(() => {});
      if (updatedOrder.buyerId) {
        this.telegram.sendBuyerOrderNotification(updatedOrder.buyerId, updatedOrder, 'status_updated', status).catch(() => {});
      }
    }

    return { updated, skipped };
  }

  /**
   * Admin console: mark CASH / CARD_ON_DELIVERY as PAID (max 100).
   */
  async adminBulkMarkPaid(
    orderIds: string[],
    actorUserId: string,
  ): Promise<{ updated: number; skipped: { id: string; reason: string }[] }> {
    const ids = [...new Set(orderIds)].filter(Boolean).slice(0, 100);
    const skipped: { id: string; reason: string }[] = [];
    let updated = 0;

    for (const id of ids) {
      const order = await this.prisma.order.findUnique({ where: { id } });
      if (!order) {
        skipped.push({ id, reason: 'not_found' });
        continue;
      }
      if (order.paymentMethod !== 'CASH' && order.paymentMethod !== 'CARD_ON_DELIVERY') {
        skipped.push({ id, reason: 'wrong_payment_method' });
        continue;
      }
      if (order.paymentStatus === 'PAID') {
        skipped.push({ id, reason: 'already_paid' });
        continue;
      }

      await this.prisma.order.update({
        where: { id },
        data: { paymentStatus: 'PAID' },
      });
      updated += 1;

      this.appendOrderAudit(id, actorUserId, 'ADMIN_BULK_MARK_PAID', { paymentMethod: order.paymentMethod });
    }

    return { updated, skipped };
  }
}
