import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckoutSessionDto, DeliveryType } from './dto/create-checkout-session.dto';
import { Decimal } from '@prisma/client/runtime/library';

const PAY_FIRST_METHODS = ['CLICK', 'PAYME'];

@Injectable()
export class CheckoutSessionService {
  constructor(private prisma: PrismaService) {}

  async createSession(buyerId: string, dto: CreateCheckoutSessionDto): Promise<{ sessionId: string }> {
    if (!PAY_FIRST_METHODS.includes(dto.paymentMethod)) {
      throw new BadRequestException('Checkout session only for CLICK or PAYME');
    }
    const deliveryType = (dto.deliveryType ?? DeliveryType.DELIVERY) as string;
    if (deliveryType === 'DELIVERY' && !dto.shippingAddress) {
      throw new BadRequestException('Shipping address required for delivery');
    }

    const cart = await this.prisma.cart.findFirst({
      where: { userId: buyerId },
      include: { items: { include: { product: { include: { shop: true } }, variant: true } } },
    });
    if (!cart || !cart.items.length) throw new BadRequestException('Cart is empty');

    const shopIds = new Set(cart.items.map((i) => i.product.shopId));
    if (shopIds.size > 1) {
      throw new BadRequestException(
        "Click yoki Payme faqat bitta do'kondan buyurtma uchun. Boshqa to'lov turini tanlang yoki savatni bitta do'konga qisqartiring.",
      );
    }

    const outOfStockMessages: string[] = [];
    for (const item of cart.items) {
      const available = item.variantId && item.variant ? item.variant.stock : item.product.stock;
      if (available < item.quantity) {
        outOfStockMessages.push(
          `"${item.product.title}": ${item.quantity} ta soʻralgan, mavjud ${available} ta`,
        );
      }
    }
    if (outOfStockMessages.length > 0) {
      throw new BadRequestException({
        message: "Ba'zi mahsulotlar yetarli miqdorda mavjud emas.",
        outOfStock: outOfStockMessages,
      });
    }

    const sellerId = cart.items[0]!.product.shop.userId;
    const cartSnapshot = cart.items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId ?? undefined,
      quantity: i.quantity,
      price: i.variant?.priceOverride != null ? Number(i.variant.priceOverride) : Number(i.product.price),
      sellerId,
    }));
    const totalAmount = cartSnapshot.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const shippingAddress = (dto.shippingAddress && typeof dto.shippingAddress === 'object'
      ? dto.shippingAddress
      : {}) as object;

    const session = await this.prisma.checkoutSession.create({
      data: {
        buyerId,
        cartSnapshot: cartSnapshot as object,
        shippingAddress,
        deliveryType,
        paymentMethod: dto.paymentMethod,
        totalAmount: new Decimal(totalAmount),
        notes: dto.notes ?? undefined,
      },
    });
    return { sessionId: session.id };
  }

  async getOrderIdBySessionId(sessionId: string): Promise<{ orderId: string } | null> {
    const session = await this.prisma.checkoutSession.findUnique({
      where: { id: sessionId },
      select: { orderId: true },
    });
    if (!session?.orderId) return null;
    return { orderId: session.orderId };
  }
}
