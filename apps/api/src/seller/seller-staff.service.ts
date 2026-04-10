import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCashierDto } from './dto/create-cashier.dto';

@Injectable()
export class SellerStaffService {
  constructor(private prisma: PrismaService) {}

  async listCashiers(sellerUserId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { userId: sellerUserId },
      select: { id: true },
    });
    if (!shop) return [];
    return this.prisma.user.findMany({
      where: { staffShopId: shop.id, role: UserRole.CASHIER },
      select: { id: true, email: true, firstName: true, lastName: true, phone: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCashier(sellerUserId: string, dto: CreateCashierDto) {
    const shop = await this.prisma.shop.findUnique({
      where: { userId: sellerUserId },
      select: { id: true },
    });
    if (!shop) {
      throw new BadRequestException("Avval do'kon yarating.");
    }
    const email = dto.email.trim().toLowerCase();
    const taken = await this.prisma.user.findUnique({ where: { email } });
    if (taken) {
      throw new ConflictException('Bu email allaqachon roʻyxatdan oʻtgan.');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        phone: dto.phone?.trim() || null,
        role: UserRole.CASHIER,
        staffShopId: shop.id,
        emailVerified: true,
      },
      select: { id: true, email: true, firstName: true, lastName: true, phone: true },
    });
  }

  async removeCashier(sellerUserId: string, cashierId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { userId: sellerUserId },
      select: { id: true },
    });
    if (!shop) throw new NotFoundException('Doʻkon topilmadi');
    const cashier = await this.prisma.user.findFirst({
      where: { id: cashierId, staffShopId: shop.id, role: UserRole.CASHIER },
    });
    if (!cashier) throw new NotFoundException('Kassir topilmadi');
    await this.prisma.user.update({
      where: { id: cashierId },
      data: { role: UserRole.BUYER, staffShopId: null },
    });
    return { success: true };
  }
}
