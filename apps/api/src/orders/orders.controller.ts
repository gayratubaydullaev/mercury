import { Controller, Get, Post, Body, Param, Query, UseGuards, Req, Res, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { OrdersService } from './orders.service';
import { OrdersControllerCreateResponse } from './orders.controller.types';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreatePosOrderDto } from './dto/create-pos-order.dto';
import { ProcessOrderReturnDto } from './dto/process-order-return.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { RequestAuthUser } from '../auth/request-user.types';
import { UserRole, OrderStatus, PaymentStatus } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { CartService } from '../cart/cart.service';

const CART_SESSION_HEADER = 'x-cart-session';
const REFRESH_COOKIE = 'refreshToken';
const COOKIE_OPTIONS = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' };

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(
    private orders: OrdersService,
    private jwtService: JwtService,
    private authService: AuthService,
    private cartService: CartService,
  ) {}

  @Post()
  @Public()
  @ApiOperation({ summary: 'Create order from cart (auth or guest); guest gets auto-registered and guestAuth in response' })
  async create(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() dto: CreateOrderDto): Promise<OrdersControllerCreateResponse> {
    const sessionId = (req.headers[CART_SESSION_HEADER] as string) ?? req.cookies?.cartSessionId ?? null;
    let userId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = this.jwtService.verify(authHeader.slice(7));
        userId = payload.sub ?? null;
      } catch {
        // ignore invalid token
      }
    }

    if (!userId && dto.guestPhone?.trim()) {
      const guestAuth = await this.authService.registerOrLoginGuest({
        phone: dto.guestPhone.trim(),
        firstName: dto.guestFirstName?.trim(),
        lastName: dto.guestLastName?.trim(),
        email: dto.guestEmail?.trim(),
      });
      userId = guestAuth.user.id;
      if (sessionId) {
        await this.cartService.mergeCart(sessionId, userId);
      }
      const orders = await this.orders.create(userId, null, dto);
      res.cookie(REFRESH_COOKIE, guestAuth.refreshToken, COOKIE_OPTIONS);
      return { orders, guestAuth: { accessToken: guestAuth.accessToken, expiresAt: guestAuth.expiresAt, user: guestAuth.user } };
    }

    const orders = await this.orders.create(userId, sessionId, dto);
    return { orders };
  }

  @Post('pos')
  @Roles(UserRole.SELLER, UserRole.CASHIER)
  @ApiOperation({ summary: 'Create in-store order (POS) for own shop — no buyer cart' })
  createPos(@CurrentUser('id') userId: string, @Body() dto: CreatePosOrderDto) {
    return this.orders.createPosOrder(userId, dto);
  }

  @Get('my')
  @Roles(UserRole.BUYER)
  @ApiOperation({ summary: 'My orders' })
  myOrders(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    return this.orders.findMyOrders(userId, pageNum, limitNum);
  }

  @Get('seller')
  @Roles(UserRole.SELLER, UserRole.CASHIER)
  @ApiOperation({ summary: 'Seller / cashier orders (shop owner id)' })
  sellerOrders(
    @CurrentUser() user: RequestAuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('search') search?: string,
  ) {
    const ownerId = user.effectiveSellerId;
    if (!ownerId) return { data: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const statusFilter = status && Object.values(OrderStatus).includes(status as OrderStatus) ? (status as OrderStatus) : undefined;
    const paymentFilter =
      paymentStatus && Object.values(PaymentStatus).includes(paymentStatus as PaymentStatus)
        ? (paymentStatus as PaymentStatus)
        : undefined;
    return this.orders.findSellerOrders(ownerId, pageNum, limitNum, statusFilter, paymentFilter, search);
  }

  @Get('guest-lookup')
  @Public()
  @ApiOperation({ summary: 'Guest order lookup by order number + phone (no auth)' })
  guestLookup(@Query('orderNumber') orderNumber: string, @Query('guestPhone') guestPhone: string) {
    return this.orders.findGuestOrderByNumberAndPhone(orderNumber ?? '', guestPhone ?? '');
  }

  @Get(':id/guest-view')
  @Public()
  @ApiOperation({ summary: 'Get order by guest view token (no auth)' })
  findOneGuestView(@Param('id') id: string, @Query('token') token: string) {
    return this.orders.findOneByGuestToken(id, token ?? '');
  }

  @Get(':id/audit')
  @ApiOperation({ summary: 'Order audit log (buyer / seller / admin with access)' })
  getOrderAudit(@Param('id') id: string, @CurrentUser() user: RequestAuthUser) {
    return this.orders.getOrderAudit(id, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order' })
  findOne(@Param('id') id: string, @CurrentUser() user: RequestAuthUser) {
    return this.orders.findOne(id, user);
  }

  @Post(':id/status')
  @Roles(UserRole.SELLER, UserRole.CASHIER)
  @ApiOperation({ summary: 'Update order status (seller / cashier)' })
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: RequestAuthUser,
    @Body() dto: UpdateOrderStatusDto
  ) {
    const ownerId = user.effectiveSellerId;
    if (!ownerId) throw new ForbiddenException();
    return this.orders.updateStatus(id, ownerId, user.id, dto.status);
  }

  @Post(':id/mark-paid')
  @Roles(UserRole.SELLER, UserRole.CASHIER)
  @ApiOperation({ summary: 'Mark order as paid (seller / cashier; CASH / CARD_ON_DELIVERY)' })
  markAsPaid(@Param('id') id: string, @CurrentUser() user: RequestAuthUser) {
    const ownerId = user.effectiveSellerId;
    if (!ownerId) throw new ForbiddenException();
    return this.orders.markAsPaid(id, ownerId, user.id);
  }

  @Post(':id/return')
  @Roles(UserRole.SELLER)
  @ApiOperation({
    summary: 'Qaytaruv (faqat sotuvchi): ombor zaxirasini tiklash, chek boʻyicha toʻliq yoki qisman',
    description:
      'Kassirlar uchun yoʻq. fullOrder: true yoki items: [{ orderItemId, quantity }]. Toʻliq qaytaruvda PAID → REFUNDED.',
  })
  processReturn(
    @Param('id') id: string,
    @CurrentUser('id') sellerUserId: string,
    @Body() dto: ProcessOrderReturnDto,
  ) {
    return this.orders.processSellerReturn(sellerUserId, id, dto);
  }
}
