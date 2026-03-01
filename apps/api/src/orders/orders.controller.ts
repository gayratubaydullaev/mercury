import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserRole, OrderStatus } from '@prisma/client';

const CART_SESSION_HEADER = 'x-cart-session';

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(
    private orders: OrdersService,
    private jwtService: JwtService,
  ) {}

  @Post()
  @Public()
  @ApiOperation({ summary: 'Create order from cart (auth or guest)' })
  create(@Req() req: Request, @Body() dto: CreateOrderDto) {
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
    return this.orders.create(userId, sessionId, dto);
  }

  @Get('my')
  @Roles(UserRole.BUYER)
  @ApiOperation({ summary: 'My orders' })
  myOrders(
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    return this.orders.findMyOrders(userId, page ?? 1, limit ?? 20);
  }

  @Get('seller')
  @Roles(UserRole.SELLER)
  @ApiOperation({ summary: 'Seller orders' })
  sellerOrders(
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string
  ) {
    const statusFilter = status && Object.values(OrderStatus).includes(status as OrderStatus) ? (status as OrderStatus) : undefined;
    return this.orders.findSellerOrders(userId, page ?? 1, limit ?? 20, statusFilter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order' })
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentUser('role') role: string) {
    return this.orders.findOne(id, userId, role);
  }

  @Post(':id/status')
  @Roles(UserRole.SELLER)
  @ApiOperation({ summary: 'Update order status (seller)' })
  updateStatus(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateOrderStatusDto
  ) {
    return this.orders.updateStatus(id, userId, dto.status);
  }
}
