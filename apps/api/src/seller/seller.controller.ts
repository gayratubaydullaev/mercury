import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SellerService } from './seller.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('seller')
@Controller('seller')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SELLER)
@ApiBearerAuth()
export class SellerController {
  constructor(private seller: SellerService) {}

  @Get('shop')
  @ApiOperation({ summary: 'Get my shop' })
  getShop(@CurrentUser('id') userId: string) {
    return this.seller.getShop(userId);
  }

  @Post('shop')
  @ApiOperation({ summary: 'Create or update shop' })
  createOrUpdateShop(
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      name: string;
      slug?: string;
      description?: string;
      pickupAddress?: { city?: string; district?: string; street?: string; house?: string; phone?: string } | null;
      chatEnabled?: boolean;
    },
  ) {
    return this.seller.createOrUpdateShop(userId, body);
  }

  @Post('shop/chat')
  @ApiOperation({ summary: 'Enable or disable chat for my shop' })
  setChatEnabled(@CurrentUser('id') userId: string, @Body() body: { chatEnabled: boolean }) {
    return this.seller.setChatEnabled(userId, !!body.chatEnabled);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Seller stats' })
  getStats(@CurrentUser('id') userId: string) {
    return this.seller.getStats(userId);
  }

  @Get('reviews')
  @ApiOperation({ summary: 'Reviews for my shop products (to reply)' })
  getReviews(@CurrentUser('id') userId: string) {
    return this.seller.getReviewsForShop(userId);
  }
}
