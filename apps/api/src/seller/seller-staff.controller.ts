import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { SellerStaffService } from './seller-staff.service';
import { CreateCashierDto } from './dto/create-cashier.dto';

@ApiTags('seller')
@Controller('seller/staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SELLER)
@ApiBearerAuth()
export class SellerStaffController {
  constructor(private staff: SellerStaffService) {}

  @Get()
  @ApiOperation({ summary: 'List cashiers for my shop' })
  list(@CurrentUser('id') sellerId: string) {
    return this.staff.listCashiers(sellerId);
  }

  @Post()
  @ApiOperation({ summary: 'Create cashier account for my shop' })
  create(@CurrentUser('id') sellerId: string, @Body() dto: CreateCashierDto) {
    return this.staff.createCashier(sellerId, dto);
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Remove cashier from shop (account becomes buyer)' })
  remove(@CurrentUser('id') sellerId: string, @Param('userId') userId: string) {
    return this.staff.removeCashier(sellerId, userId);
  }
}
