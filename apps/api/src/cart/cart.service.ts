import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { Prisma } from '@prisma/client';

const cartInclude = {
  items: {
    include: {
      product: {
        include: {
          images: true,
          shop: { select: { id: true, name: true, pickupAddress: true } },
        },
      },
      variant: true,
    },
  },
} as const;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  async getOrCreateCart(userId: string | null, sessionId: string | null): Promise<CartWithItems> {
    return this.prisma.$transaction(async (tx) => {
      const effectiveSessionId =
        sessionId ?? (!userId ? `anon-${Date.now()}-${Math.random().toString(36).slice(2)}` : null);
      if (userId) await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      if (effectiveSessionId) await tx.$executeRaw`SELECT set_config('app.session_id', ${effectiveSessionId}, true)`;

      if (userId) {
        let cart = await tx.cart.findUnique({
          where: { userId },
          include: cartInclude,
        });
        if (!cart) cart = await tx.cart.create({ data: { userId }, include: cartInclude });
        return cart;
      }
      if (effectiveSessionId) {
        let cart = await tx.cart.findFirst({
          where: { sessionId: effectiveSessionId },
          include: cartInclude,
        });
        if (!cart) cart = await tx.cart.create({ data: { sessionId: effectiveSessionId }, include: cartInclude });
        return cart;
      }
      throw new Error('Cart session required');
    });
  }

  async addItem(userId: string | null, sessionId: string | null, dto: AddCartItemDto): Promise<CartWithItems> {
    return this.prisma.$transaction(async (tx) => {
      const effectiveSessionId =
        sessionId ?? (!userId ? `anon-${Date.now()}-${Math.random().toString(36).slice(2)}` : null);
      if (userId) await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      if (effectiveSessionId) await tx.$executeRaw`SELECT set_config('app.session_id', ${effectiveSessionId}, true)`;

      let cart: CartWithItems;
      if (userId) {
        let c = await tx.cart.findUnique({ where: { userId }, include: cartInclude });
        if (!c) c = await tx.cart.create({ data: { userId }, include: cartInclude });
        cart = c;
      } else if (effectiveSessionId) {
        let c = await tx.cart.findFirst({ where: { sessionId: effectiveSessionId }, include: cartInclude });
        if (!c) c = await tx.cart.create({ data: { sessionId: effectiveSessionId }, include: cartInclude });
        cart = c;
      } else {
        throw new Error('Cart session required');
      }

      const variantId = dto.variantId ?? null;
      const existing =
        variantId != null
          ? await tx.cartItem.findUnique({
              where: { cartId_productId_variantId: { cartId: cart.id, productId: dto.productId, variantId } },
            })
          : await tx.cartItem.findFirst({
              where: { cartId: cart.id, productId: dto.productId, variantId: null },
            });
      if (existing) {
        await tx.cartItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + (dto.quantity ?? 1) },
        });
      } else {
        await tx.cartItem.create({
          data: { cartId: cart.id, productId: dto.productId, variantId, quantity: dto.quantity ?? 1 },
        });
      }

      const updated = await tx.cart.findUniqueOrThrow({
        where: { id: cart.id },
        include: cartInclude,
      });
      return updated;
    });
  }

  async updateQuantity(
    cartId: string,
    productId: string,
    quantity: number,
    userId?: string,
    sessionId?: string,
    variantId?: string | null
  ): Promise<CartWithItems> {
    return this.prisma.$transaction(async (tx) => {
      if (userId) await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      if (sessionId) await tx.$executeRaw`SELECT set_config('app.session_id', ${sessionId}, true)`;

      const cart = await tx.cart.findFirst({
        where: { id: cartId, ...(userId ? { userId } : { sessionId }) },
      });
      if (!cart) throw new NotFoundException('Cart not found');
      const vid = variantId ?? null;
      if (quantity <= 0) {
        await tx.cartItem.deleteMany({ where: { cartId, productId, variantId: vid } });
      } else {
        const existing =
          vid != null
            ? await tx.cartItem.findUnique({
                where: { cartId_productId_variantId: { cartId, productId, variantId: vid } },
              })
            : await tx.cartItem.findFirst({ where: { cartId, productId, variantId: null } });
        if (existing) {
          await tx.cartItem.update({ where: { id: existing.id }, data: { quantity } });
        } else {
          await tx.cartItem.create({ data: { cartId, productId, variantId: vid, quantity } });
        }
      }
      return tx.cart.findUniqueOrThrow({ where: { id: cartId }, include: cartInclude });
    });
  }

  async removeItem(cartId: string, productId: string, userId?: string, sessionId?: string, variantId?: string | null): Promise<CartWithItems> {
    return this.prisma.$transaction(async (tx) => {
      if (userId) await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      if (sessionId) await tx.$executeRaw`SELECT set_config('app.session_id', ${sessionId}, true)`;

      const cart = await tx.cart.findFirst({
        where: { id: cartId, ...(userId ? { userId } : { sessionId }) },
      });
      if (!cart) throw new NotFoundException('Cart not found');
      await tx.cartItem.deleteMany({ where: { cartId, productId, variantId: variantId ?? null } });
      return tx.cart.findUniqueOrThrow({ where: { id: cartId }, include: cartInclude });
    });
  }

  async mergeCart(sessionId: string, userId: string): Promise<CartWithItems> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.session_id', ${sessionId}, true)`;

      const guestCart = await tx.cart.findFirst({ where: { sessionId }, include: { items: true } });
      if (!guestCart?.items.length) return this.getOrCreateCart(userId, null);

      let userCart = await tx.cart.findUnique({ where: { userId }, include: cartInclude });
      if (!userCart) userCart = await tx.cart.create({ data: { userId }, include: cartInclude });

      for (const item of guestCart.items) {
        const variantId = item.variantId ?? null;
        const existing =
          variantId != null
            ? await tx.cartItem.findUnique({
                where: { cartId_productId_variantId: { cartId: userCart.id, productId: item.productId, variantId } },
              })
            : await tx.cartItem.findFirst({
                where: { cartId: userCart.id, productId: item.productId, variantId: null },
              });
        if (existing) {
          await tx.cartItem.update({
            where: { id: existing.id },
            data: { quantity: { increment: item.quantity } },
          });
        } else {
          await tx.cartItem.create({
            data: { cartId: userCart.id, productId: item.productId, variantId, quantity: item.quantity },
          });
        }
      }
      await tx.cart.delete({ where: { id: guestCart.id } });
      return tx.cart.findUniqueOrThrow({ where: { id: userCart.id }, include: cartInclude });
    });
  }
}
