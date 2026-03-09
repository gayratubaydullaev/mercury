import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CheckoutSessionService } from './checkout-session.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('checkout-session')
@Controller('checkout-session')
export class CheckoutSessionController {
  constructor(private readonly checkoutSession: CheckoutSessionService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUYER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create checkout session for CLICK/PAYME (pay first)' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateCheckoutSessionDto) {
    return this.checkoutSession.createSession(userId, dto);
  }

  @Get(':id/order')
  @Public()
  @ApiOperation({ summary: 'Get order id by session id (after payment)' })
  getOrderBySession(@Param('id') id: string) {
    return this.checkoutSession.getOrderIdBySessionId(id);
  }
}
