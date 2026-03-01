import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, Delete, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { BlockUserDto } from './dto/block-user.dto';
import { SetRoleDto } from './dto/set-role.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { ModerateProductDto } from './dto/moderate-product.dto';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { RecordPayoutDto } from './dto/record-payout.dto';
import { SetSellerCommissionDto } from './dto/set-seller-commission.dto';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List users' })
  getUsers(@Req() req: Request, @Query('page') page?: number, @Query('limit') limit?: number, @Query('role') role?: UserRole) {
    return this.admin.getUsers(req, page ?? 1, limit ?? 20, role);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user profile (admin)' })
  getUserById(@Req() req: Request, @Param('id') id: string) {
    return this.admin.getUserById(req, id);
  }

  @Post('users/:id/block')
  @ApiOperation({ summary: 'Block user' })
  blockUser(@Param('id') id: string, @Body() dto: BlockUserDto) {
    return this.admin.blockUser(id, dto.block);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Set user role' })
  setRole(@Param('id') id: string, @Body() dto: SetRoleDto) {
    return this.admin.setRole(id, dto.role);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List categories' })
  getCategories() {
    return this.admin.getCategories();
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create category' })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.admin.createCategory(dto);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update category' })
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.admin.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Delete category' })
  deleteCategory(@Param('id') id: string) {
    return this.admin.deleteCategory(id);
  }

  @Get('banners')
  @ApiOperation({ summary: 'List all banners' })
  getBanners() {
    return this.admin.getBanners();
  }

  @Post('banners')
  @ApiOperation({ summary: 'Create banner' })
  createBanner(@Body() dto: CreateBannerDto) {
    return this.admin.createBanner(dto);
  }

  @Patch('banners/:id')
  @ApiOperation({ summary: 'Update banner' })
  updateBanner(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.admin.updateBanner(id, dto);
  }

  @Delete('banners/:id')
  @ApiOperation({ summary: 'Delete banner' })
  deleteBanner(@Param('id') id: string) {
    return this.admin.deleteBanner(id);
  }

  @Get('products')
  @ApiOperation({ summary: 'List products for moderation' })
  getProducts(@Query('page') page?: number, @Query('limit') limit?: number, @Query('isModerated') isModerated?: string) {
    const filter = isModerated === 'true' ? true : isModerated === 'false' ? false : undefined;
    return this.admin.getProductsForModeration(page ?? 1, limit ?? 20, filter);
  }

  @Post('products/:id/moderate')
  @ApiOperation({ summary: 'Moderate product' })
  moderateProduct(@Param('id') id: string, @Body() dto: ModerateProductDto) {
    return this.admin.moderateProduct(id, dto.approve);
  }

  @Get('orders')
  @ApiOperation({ summary: 'List all orders' })
  getOrders(@Req() req: Request, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.admin.getOrders(req, page ?? 1, limit ?? 20);
  }

  @Get('sellers')
  @ApiOperation({ summary: 'List sellers with stats' })
  getSellers(@Req() req: Request, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.admin.getSellers(req, page ?? 1, limit ?? 20);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Platform stats' })
  getStats() {
    return this.admin.getStats();
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get platform settings' })
  getPlatformSettings() {
    return this.admin.getPlatformSettings();
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update platform settings' })
  updatePlatformSettings(@Body() dto: UpdatePlatformSettingsDto) {
    return this.admin.updatePlatformSettings(dto);
  }

  @Get('payouts')
  @ApiOperation({ summary: 'List payouts by seller (commission, totalPaid, balance)' })
  getPayouts(@Req() req: Request, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.admin.getPayouts(req, page ?? 1, limit ?? 20);
  }

  @Post('payouts/record')
  @ApiOperation({ summary: 'Record payment received from seller (e.g. cash)' })
  recordPayout(@Body() dto: RecordPayoutDto) {
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : undefined;
    return this.admin.recordPayout(dto.sellerId, dto.amount, dto.method ?? 'CASH', paidAt, dto.note);
  }

  @Patch('sellers/:id/commission')
  @ApiOperation({ summary: 'Set seller commission % (null = platform default)' })
  setSellerCommission(@Param('id') id: string, @Body() dto: SetSellerCommissionDto) {
    return this.admin.setSellerCommissionRate(id, dto.commissionRate);
  }

  @Get('reviews')
  @ApiOperation({ summary: 'List all reviews (for admin)' })
  getReviews(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.admin.getReviews(page ?? 1, limit ?? 20);
  }
}