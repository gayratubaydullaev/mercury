import { Controller, Get, Post, Body, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private reviews: ReviewsService) {}

  @Get('product/:productId')
  @Public()
  @ApiOperation({ summary: 'Get reviews for product' })
  getForProduct(@Param('productId') productId: string) {
    return this.reviews.getForProduct(productId);
  }

  @Get('product/:productId/can-review')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.BUYER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if current user can leave a review for this product' })
  canReview(@Param('productId') productId: string, @CurrentUser('id') userId: string) {
    return this.reviews.canLeaveReview(productId, userId);
  }

  @Post('product/:productId')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.BUYER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or update review' })
  create(
    @Param('productId') productId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { rating: number; comment?: string }
  ) {
    return this.reviews.create(productId, userId, body.rating, body.comment);
  }

  @Post(':id/reply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Seller reply to review' })
  reply(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() body: { reply?: string }) {
    return this.reviews.sellerReply(id, userId, body.reply ?? '');
  }

  @Post(':id/moderate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: approve or reject review' })
  moderate(@Param('id') id: string, @Body() body: { approve: boolean }) {
    return this.reviews.setModerated(id, !!body.approve);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: delete review' })
  remove(@Param('id') id: string) {
    return this.reviews.remove(id);
  }
}