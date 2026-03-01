import { Controller, Get, Post, Body, Patch, Param, Delete, Req, Res, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const CART_COOKIE = 'cartSessionId';
const CART_COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

@ApiTags('cart')
@Controller('cart')
export class CartController {
  constructor(private cart: CartService) {}

  private getSessionId(req: Request): string | null {
    return req.cookies?.[CART_COOKIE] ?? req.headers['x-cart-session'] ?? null;
  }

  private setCartCookieIfAnonymous(res: Response, userId: string | undefined, cart: { sessionId: string | null }) {
    if (userId) return;
    if (cart.sessionId) {
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie(CART_COOKIE, cart.sessionId, {
        path: '/',
        maxAge: CART_COOKIE_MAX_AGE,
        sameSite: isProduction ? 'none' : 'lax',
        httpOnly: true,
        secure: isProduction,
      });
    }
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get cart (anonymous or user)' })
  async getCart(@Req() req: Request, @Res({ passthrough: true }) res: Response, @CurrentUser('id') userId?: string) {
    const sessionId = this.getSessionId(req);
    const cart = await this.cart.getOrCreateCart(userId ?? null, sessionId);
    this.setCartCookieIfAnonymous(res, userId, cart);
    return cart;
  }

  @Post('items')
  @Public()
  @ApiOperation({ summary: 'Add to cart' })
  async addItem(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: AddCartItemDto,
    @CurrentUser('id') userId?: string
  ) {
    const sessionId = this.getSessionId(req);
    const cart = await this.cart.addItem(userId ?? null, sessionId, dto);
    this.setCartCookieIfAnonymous(res, userId, cart);
    return cart;
  }

  @Patch('items/:productId')
  @Public()
  @ApiOperation({ summary: 'Update quantity' })
  async updateQuantity(
    @Param('productId') productId: string,
    @Body('quantity') quantity: number,
    @Req() req: Request,
    @CurrentUser('id') userId?: string,
    @Query('variantId') variantId?: string
  ) {
    const cart = await this.cart.getOrCreateCart(userId ?? null, this.getSessionId(req));
    return this.cart.updateQuantity(cart.id, productId, quantity, userId ?? undefined, this.getSessionId(req) ?? undefined, variantId ?? null);
  }

  @Delete('items/:productId')
  @Public()
  @ApiOperation({ summary: 'Remove from cart' })
  async removeItem(
    @Param('productId') productId: string,
    @Req() req: Request,
    @CurrentUser('id') userId?: string,
    @Query('variantId') variantId?: string
  ) {
    const cart = await this.cart.getOrCreateCart(userId ?? null, this.getSessionId(req));
    return this.cart.removeItem(cart.id, productId, userId ?? undefined, this.getSessionId(req) ?? undefined, variantId ?? null);
  }
}
