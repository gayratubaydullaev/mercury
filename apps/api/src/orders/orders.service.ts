import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOrderDto, DeliveryType } from './dto/create-order.dto';
import { CreatePosOrderDto } from './dto/create-pos-order.dto';
import { OrderStatus, PaymentStatus, Prisma, UserRole } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import type { RequestAuthUser } from '../auth/request-user.types';

type Tx = Prisma.TransactionClient;

type OrderFromCartCreate = Prisma.OrderGetPayload<{
  include: {
    items: { include: { product: { include: { images: true; shop: true } }; variant: true } };
    seller: { include: { shop: true } };
    buyer: { select: { firstName: true; lastName: true; email: true; phone: true } };
  };
}>;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
    private notifications: NotificationsService,
  ) {}

  private async generateOrderNumber(tx?: Tx) {
    const db = tx ?? this.prisma;
    const count = await db.order.count();
    return `ORD-${Date.now().toString(36).toUpperCase()}-${(count + 1).toString().padStart(5, '0')}`;
  }

  private async decrementStockForLines(
    tx: Tx,
    lines: { productId: string; variantId?: string | null; quantity: number }[],
  ) {
    for (const line of lines) {
      if (line.variantId) {
        const r = await tx.productVariant.updateMany({
          where: { id: line.variantId, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (r.count !== 1) {
          throw new BadRequestException('Omborda yetarli mahsulot yoʻq (variant).');
        }
      } else {
        const r = await tx.product.updateMany({
          where: { id: line.productId, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (r.count !== 1) {
          throw new BadRequestException('Omborda yetarli mahsulot yoʻq.');
        }
      }
    }
  }

  private async restoreStockForOrderItems(
    tx: Tx,
    items: { productId: string; variantId: string | null; quantity: number }[],
  ) {
    for (const item of items) {
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      } else {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }
  }

  private sellerAccess(auth: RequestAuthUser, orderSellerId: string): boolean {
    if (auth.role === UserRole.ADMIN || auth.role === UserRole.ADMIN_MODERATOR) return true;
    if (auth.role === UserRole.SELLER && orderSellerId === auth.id) return true;
    if (auth.role === UserRole.CASHIER && auth.effectiveSellerId === orderSellerId) return true;
    return false;
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

    const orders: OrderFromCartCreate[] = [];
    const shippingPayload = deliveryType === DeliveryType.PICKUP
      ? (dto.shippingAddress && typeof dto.shippingAddress === 'object' ? dto.shippingAddress : {})
      : (dto.shippingAddress as object);
    const stockDeductedAt = new Date();
    const guestViewToken = isGuest ? randomBytes(24).toString('hex') : undefined;

    await this.prisma.$transaction(async (tx) => {
      for (const [, items] of byShop) {
        const orderNumber = await this.generateOrderNumber(tx);
        const sellerId = items[0]!.product.shop.userId;
        const totalAmount = items.reduce((sum, i) => {
          const price = i.variant?.priceOverride != null ? Number(i.variant.priceOverride) : Number(i.product.price);
          return sum + price * i.quantity;
        }, 0);
        const order = await tx.order.create({
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
            stockDeductedAt,
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
        await this.decrementStockForLines(
          tx,
          items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
          })),
        );
        orders.push(order);
      }
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    });

    for (const order of orders) {
      this.appendOrderAudit(order.id, order.buyerId ?? null, 'ORDER_CREATED', {
        source: 'cart',
        paymentMethod: dto.paymentMethod,
        deliveryType,
        orderNumber: order.orderNumber,
      });
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
    this.logger.log(`Orders created: ${orders.map((o) => o.id).join(', ')} for ${buyerId ?? 'guest'}`);
    return orders;
  }

  /**
   * In-store sale (Point of Sale): seller or cashier creates an order for their shop without a buyer cart.
   */
  async createPosOrder(actorUserId: string, dto: CreatePosOrderDto) {
    const actor = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: {
        id: true,
        role: true,
        staffShop: { select: { id: true, userId: true } },
        shop: { select: { id: true } },
      },
    });
    if (!actor) throw new BadRequestException('Foydalanuvchi topilmadi');
    let shopId: string;
    let ownerSellerId: string;
    if (actor.role === UserRole.SELLER && actor.shop) {
      shopId = actor.shop.id;
      ownerSellerId = actor.id;
    } else if (actor.role === UserRole.CASHIER && actor.staffShop) {
      shopId = actor.staffShop.id;
      ownerSellerId = actor.staffShop.userId;
    } else {
      throw new BadRequestException("Avval do'kon yarating yoki kassir hisobi doʻkonga bogʻlanganligini tekshiring.");
    }

    const merged = new Map<string, { productId: string; variantId?: string; quantity: number }>();
    for (const line of dto.items) {
      const key = `${line.productId}:${line.variantId ?? ''}`;
      const prev = merged.get(key);
      if (prev) prev.quantity += line.quantity;
      else merged.set(key, { productId: line.productId, variantId: line.variantId, quantity: line.quantity });
    }
    const lines = [...merged.values()];

    const productIds = [...new Set(lines.map((l) => l.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, shopId, isActive: true },
      include: { variants: true },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException(
        "Ba'zi mahsulotlar topilmadi, nofaol yoki boshqa do'konga tegishli.",
      );
    }
    const byId = new Map(products.map((p) => [p.id, p]));

    const outOfStock: string[] = [];
    for (const line of lines) {
      const p = byId.get(line.productId)!;
      if (p.variants.length > 0) {
        if (!line.variantId) {
          throw new BadRequestException(`Variant tanlash kerak: "${p.title}"`);
        }
        const v = p.variants.find((x) => x.id === line.variantId);
        if (!v) {
          throw new BadRequestException(`Variant mos emas: "${p.title}"`);
        }
        if (v.stock < line.quantity) {
          outOfStock.push(`"${p.title}": ${line.quantity} soʻralgan, mavjud ${v.stock}`);
        }
      } else if (line.variantId) {
        throw new BadRequestException(`Bu tovarda variant yoʻq: "${p.title}"`);
      } else if (p.stock < line.quantity) {
        outOfStock.push(`"${p.title}": ${line.quantity} soʻralgan, mavjud ${p.stock}`);
      }
    }
    if (outOfStock.length > 0) {
      throw new BadRequestException({
        message: "Omborda yetarli mahsulot yoʻq.",
        outOfStock,
      });
    }

    const markPaid = dto.markPaid !== false;
    const guestPhone = dto.guestPhone?.trim() || undefined;
    const guestViewToken = guestPhone ? randomBytes(24).toString('hex') : undefined;

    const totalAmount = lines.reduce((sum, line) => {
      const p = byId.get(line.productId)!;
      if (line.variantId) {
        const v = p.variants.find((x) => x.id === line.variantId)!;
        const unit = v.priceOverride != null ? Number(v.priceOverride) : Number(p.price);
        return sum + unit * line.quantity;
      }
      return sum + Number(p.price) * line.quantity;
    }, 0);

    const stockDeductedAt = new Date();
    const order = await this.prisma.$transaction(async (tx) => {
      const orderNumber = await this.generateOrderNumber(tx);
      const o = await tx.order.create({
        data: {
          orderNumber,
          sellerId: ownerSellerId,
          paymentMethod: dto.paymentMethod,
          paymentStatus: markPaid ? 'PAID' : 'PENDING',
          status: markPaid ? 'CONFIRMED' : 'PENDING',
          deliveryType: 'PICKUP',
          totalAmount: new Decimal(totalAmount),
          shippingAddress: {},
          notes: dto.notes?.trim() || undefined,
          guestPhone,
          guestViewToken,
          stockDeductedAt,
          items: {
            create: lines.map((line) => {
              const p = byId.get(line.productId)!;
              const price =
                line.variantId != null
                  ? (() => {
                      const v = p.variants.find((x) => x.id === line.variantId)!;
                      return v.priceOverride != null ? v.priceOverride : p.price;
                    })()
                  : p.price;
              return {
                productId: line.productId,
                variantId: line.variantId,
                quantity: line.quantity,
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
      await this.decrementStockForLines(tx, lines);
      return o;
    });

    this.appendOrderAudit(order.id, actorUserId, 'ORDER_CREATED', {
      source: 'pos',
      paymentMethod: dto.paymentMethod,
      paymentStatus: order.paymentStatus,
      status: order.status,
      orderNumber: order.orderNumber,
      markPaid,
      actorRole: actor.role,
    });

    this.telegram.sendOrderNotification(order.sellerId, order, 'new_order').catch(() => {});
    this.telegram.sendAdminOrderNotification(order, 'new_order').catch(() => {});
    this.notifications
      .createForUser(order.sellerId, {
        type: 'NEW_ORDER',
        title: 'Yangi buyurtma (POS)',
        body: `${order.orderNumber} — ${Number(order.totalAmount).toLocaleString()} soʻm`,
        link: '/seller/orders',
        entityId: order.id,
      })
      .catch(() => {});

    this.logger.log(`POS order created: ${order.id} by ${actor.role} ${actorUserId}`);
    return order;
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

    const totalAmount = cartSnapshot.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const stockDeductedAt = new Date();
    const order = await this.prisma.$transaction(async (tx) => {
      const orderNumber = await this.generateOrderNumber(tx);
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
          stockDeductedAt,
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
      await this.decrementStockForLines(
        tx,
        cartSnapshot.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
        })),
      );
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

  async findOne(id: string, auth: RequestAuthUser) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true, variant: true } },
        buyer: true,
        seller: { include: { shop: { select: { id: true, name: true, slug: true } } } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    const canAccess =
      order.buyerId === auth.id ||
      this.sellerAccess(auth, order.sellerId) ||
      auth.role === UserRole.ADMIN ||
      auth.role === UserRole.ADMIN_MODERATOR;
    if (!canAccess) throw new ForbiddenException();
    return order;
  }

  /** Same access as findOne: buyer, seller/cashier of order, or platform admin. */
  async getOrderAudit(orderId: string, auth: RequestAuthUser) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, buyerId: true, sellerId: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    const canAccess =
      order.buyerId === auth.id ||
      this.sellerAccess(auth, order.sellerId) ||
      auth.role === UserRole.ADMIN ||
      auth.role === UserRole.ADMIN_MODERATOR;
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

  async updateStatus(id: string, shopOwnerSellerId: string, actorUserId: string, status: OrderStatus) {
    const order = await this.prisma.order.findFirst({
      where: { id, sellerId: shopOwnerSellerId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    const isPrepaid = order.paymentMethod === 'CLICK' || order.paymentMethod === 'PAYME';
    if ((status === 'SHIPPED' || status === 'DELIVERED') && isPrepaid && order.paymentStatus !== 'PAID') {
      throw new BadRequestException(
        'Click yoki Payme orqali toʻlov qilinmaguncha «Yuborildi» / «Yetkazildi» belgilab boʻlmaydi. Toʻlovni kuting yoki naqd/karta (yetkazishda) uchun buyurtma qiling.',
      );
    }
    const fromStatus = order.status;
    const notifyInclude = {
      items: { include: { product: { select: { title: true } }, variant: { select: { options: true } } } as const },
      buyer: { select: { firstName: true, lastName: true, email: true, phone: true } },
      seller: { select: { firstName: true, lastName: true, shop: { select: { name: true } } } },
    } as const;

    if (status === 'CANCELLED' && fromStatus !== 'CANCELLED' && order.stockDeductedAt) {
      const updated = await this.prisma.$transaction(async (tx) => {
        await this.restoreStockForOrderItems(tx, order.items);
        return tx.order.update({
          where: { id },
          data: { status, stockDeductedAt: null },
          include: notifyInclude,
        });
      });
      this.appendOrderAudit(id, actorUserId, 'SELLER_STATUS', {
        fromStatus,
        toStatus: status,
        stockRestored: true,
      });
      this.telegram.sendOrderNotification(shopOwnerSellerId, updated, 'status_updated', status).catch(() => {});
      this.telegram.sendAdminOrderNotification(updated, 'status_updated', status).catch(() => {});
      if (updated.buyerId) {
        this.telegram.sendBuyerOrderNotification(updated.buyerId, updated, 'status_updated', status).catch(() => {});
      }
      return updated;
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status },
      include: notifyInclude,
    });
    this.appendOrderAudit(id, actorUserId, 'SELLER_STATUS', { fromStatus, toStatus: status });
    this.telegram.sendOrderNotification(shopOwnerSellerId, updated, 'status_updated', status).catch(() => {});
    this.telegram.sendAdminOrderNotification(updated, 'status_updated', status).catch(() => {});
    if (updated.buyerId) {
      this.telegram.sendBuyerOrderNotification(updated.buyerId, updated, 'status_updated', status).catch(() => {});
    }
    return updated;
  }

  async markAsPaid(id: string, shopOwnerSellerId: string, actorUserId: string) {
    const markPaidInclude = {
      items: { include: { product: { select: { title: true } }, variant: { select: { options: true } } } as const },
      buyer: { select: { firstName: true, lastName: true, email: true, phone: true } },
      seller: { select: { firstName: true, lastName: true, shop: { select: { name: true } } } },
    } as const;
    const order = await this.prisma.order.findFirst({ where: { id, sellerId: shopOwnerSellerId } });
    if (!order) throw new NotFoundException('Order not found');
    const method = order.paymentMethod;
    if (method !== 'CASH' && method !== 'CARD_ON_DELIVERY') {
      throw new BadRequestException('Toʻlovni faqat naqd yoki karta (yetkazishda) usuli uchun belgilash mumkin.');
    }
    if (order.paymentStatus === 'PAID') {
      const o = await this.prisma.order.findUnique({ where: { id }, include: markPaidInclude });
      if (!o) throw new NotFoundException('Order not found');
      return o;
    }
    const updated = await this.prisma.order.update({
      where: { id },
      data: { paymentStatus: 'PAID' },
      include: markPaidInclude,
    });
    this.appendOrderAudit(id, actorUserId, 'SELLER_MARK_PAID', { paymentMethod: order.paymentMethod });
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
