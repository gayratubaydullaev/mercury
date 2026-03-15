import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, Delete, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ModeratorPermissionsGuard } from '../auth/guards/moderator-permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireModeratorPermission } from '../auth/decorators/require-moderator-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { BlockUserDto } from './dto/block-user.dto';
import { SetRoleDto } from './dto/set-role.dto';
import { SetModeratorPermissionsDto } from './dto/set-moderator-permissions.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { ModerateProductDto } from './dto/moderate-product.dto';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { RecordPayoutDto } from './dto/record-payout.dto';
import { SetSellerCommissionDto } from './dto/set-seller-commission.dto';

const SUPER_ADMIN = [UserRole.ADMIN];

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard, ModeratorPermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.ADMIN_MODERATOR)
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
  @Roles(...SUPER_ADMIN)
  @ApiOperation({ summary: 'Block user (only main admin)' })
  blockUser(@Param('id') id: string, @Body() dto: BlockUserDto, @CurrentUser('id') callerId: string) {
    return this.admin.blockUser(id, dto.block, callerId);
  }

  @Patch('users/:id/role')
  @Roles(...SUPER_ADMIN)
  @ApiOperation({ summary: 'Set user role (only main admin)' })
  setRole(@Param('id') id: string, @Body() dto: SetRoleDto, @CurrentUser('id') callerId: string, @CurrentUser('role') callerRole: string) {
    return this.admin.setRole(id, dto.role, callerId, callerRole as UserRole);
  }

  @Patch('users/:id/moderator-permissions')
  @Roles(...SUPER_ADMIN)
  @ApiOperation({ summary: 'Set moderator permissions (only for ADMIN_MODERATOR users)' })
  setModeratorPermissions(
    @Param('id') id: string,
    @Body() dto: SetModeratorPermissionsDto,
    @CurrentUser('role') callerRole: string,
  ) {
    return this.admin.setModeratorPermissions(id, callerRole as UserRole, dto);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List categories' })
  getCategories() {
    return this.admin.getCategories();
  }

  @Post('categories')
  @Roles(...SUPER_ADMIN)
  @ApiOperation({ summary: 'Create category (only main admin)' })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.admin.createCategory(dto);
  }

  @Patch('categories/:id')
  @Roles(...SUPER_ADMIN)
  @ApiOperation({ summary: 'Update category (only main admin)' })
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.admin.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @Roles(...SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete category (only main admin)' })
  deleteCategory(@Param('id') id: string) {
    return this.admin.deleteCategory(id);
  }

  @Get('banners')
  @ApiOperation({ summary: 'List all banners' })
  getBanners() {
    return this.admin.getBanners();
  }

  @Post('banners')
  @Roles(...SUPER_ADMIN)
  @ApiOperation({ summary: 'Create banner (only main admin)' })
  createBanner(@Body() dto: CreateBannerDto) {
    return this.admin.createBanner(dto);
  }

  @Patch('banners/:id')
  @Roles(...SUPER_ADMIN)
  @ApiOperation({ summary: 'Update banner (only main admin)' })
  updateBanner(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.admin.updateBanner(id, dto);
  }

  @Delete('banners/:id')
  @Roles(...SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete banner (only main admin)' })
  deleteBanner(@Param('id') id: string) {
    return this.admin.deleteBanner(id);
  }

  @Get('products')
  @RequireModeratorPermission('canModerateProducts')
  @ApiOperation({ summary: 'List products for moderation' })
  getProducts(@Query('page') page?: number, @Query('limit') limit?: number, @Query('isModerated') isModerated?: string) {
    const filter = isModerated === 'true' ? true : isModerated === 'false' ? false : undefined;
    return this.admin.getProductsForModeration(page ?? 1, limit ?? 20, filter);
  }

  @Post('products/:id/moderate')
  @RequireModeratorPermission('canModerateProducts')
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

  @Get('stats/sales-chart')
  @ApiOperation({ summary: 'Sales by day for chart (PAID orders, last N days)' })
  getSalesChart(@Query('days') days?: number) {
    return this.admin.getSalesChart(days ?? 30);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get platform settings' })
  getPlatformSettings() {
    return this.admin.getPlatformSettings();
  }

  @Patch('settings')
  @Roles(...SUPER_ADMIN)
  @ApiOperation({ summary: 'Update platform settings (only main admin)' })
  updatePlatformSettings(@Body() dto: UpdatePlatformSettingsDto) {
    return this.admin.updatePlatformSettings(dto);
  }

  @Post('telegram/link')
  @Roles(...SUPER_ADMIN)
  @ApiOperation({ summary: 'Link admin Telegram (only main admin)' })
  linkTelegram(@Body() body: { code: string }) {
    return this.admin.linkTelegram(body.code ?? '');
  }

  @Get('telegram')
  @ApiOperation({ summary: 'Get admin Telegram connection status' })
  getTelegramStatus() {
    return this.admin.getTelegramStatus();
  }

  @Post('telegram/disconnect')
  @Roles(...SUPER_ADMIN)
  @ApiOperation({ summary: 'Disconnect admin Telegram (only main admin)' })
  disconnectTelegram() {
    return this.admin.disconnectTelegram();
  }

  @Get('payouts')
  @ApiOperation({ summary: 'List payouts by seller (commission, totalPaid, balance)' })
  getPayouts(@Req() req: Request, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.admin.getPayouts(req, page ?? 1, limit ?? 20);
  }

  @Post('payouts/record')
  @Roles(...SUPER_ADMIN)
  @ApiOperation({ summary: 'Record payment received from seller (only main admin)' })
  recordPayout(@Body() dto: RecordPayoutDto) {
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : undefined;
    return this.admin.recordPayout(dto.sellerId, dto.amount, dto.method ?? 'CASH', paidAt, dto.note);
  }

  @Patch('sellers/:id/commission')
  @Roles(...SUPER_ADMIN)
  @ApiOperation({ summary: 'Set seller commission % (only main admin)' })
  setSellerCommission(@Param('id') id: string, @Body() dto: SetSellerCommissionDto) {
    return this.admin.setSellerCommissionRate(id, dto.commissionRate);
  }

  @Get('reviews')
  @RequireModeratorPermission('canModerateReviews')
  @ApiOperation({ summary: 'List all reviews (for admin)' })
  getReviews(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('isModerated') isModerated?: string,
  ) {
    const filter = isModerated === 'true' ? true : isModerated === 'false' ? false : undefined;
    return this.admin.getReviews(page ?? 1, limit ?? 20, filter);
  }

  @Get('seller-applications')
  @ApiOperation({ summary: 'List seller applications (PENDING / APPROVED / REJECTED)' })
  getSellerApplications(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.admin.getSellerApplications(page ?? 1, limit ?? 20, status);
  }

  @Post('seller-applications/:id/approve')
  @RequireModeratorPermission('canApproveSellerApplications')
  @ApiOperation({ summary: 'Approve seller application — create shop and set role SELLER' })
  approveSellerApplication(@Param('id') id: string, @CurrentUser('id') adminId: string) {
    return this.admin.approveSellerApplication(id, adminId);
  }

  @Post('seller-applications/:id/reject')
  @RequireModeratorPermission('canApproveSellerApplications')
  @ApiOperation({ summary: 'Reject seller application' })
  rejectSellerApplication(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser('id') adminId: string,
  ) {
    return this.admin.rejectSellerApplication(id, adminId, body.reason);
  }

  @Get('pending-shop-updates')
  @RequireModeratorPermission('canApproveShopUpdates')
  @ApiOperation({ summary: 'List pending shop data change requests' })
  getPendingShopUpdates(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.admin.getPendingShopUpdates(page ?? 1, limit ?? 20);
  }

  @Post('pending-shop-updates/:id/approve')
  @RequireModeratorPermission('canApproveShopUpdates')
  @ApiOperation({ summary: 'Approve pending shop update' })
  approvePendingShopUpdate(@Param('id') id: string, @CurrentUser('id') adminId: string) {
    return this.admin.approvePendingShopUpdate(id, adminId);
  }

  @Post('pending-shop-updates/:id/reject')
  @RequireModeratorPermission('canApproveShopUpdates')
  @ApiOperation({ summary: 'Reject pending shop update' })
  rejectPendingShopUpdate(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser('id') adminId: string,
  ) {
    return this.admin.rejectPendingShopUpdate(id, adminId, body.reason);
  }
}