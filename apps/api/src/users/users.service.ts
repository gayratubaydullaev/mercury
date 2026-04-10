import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        moderatorPermissions: true,
        avatarUrl: true,
        createdAt: true,
        emailVerified: true,
        telegramId: true,
        isGuest: true,
        staffShopId: true,
        shop: { select: { id: true, name: true, slug: true } },
        staffShop: { select: { id: true, name: true, slug: true, userId: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const effectiveSellerId =
      user.role === UserRole.SELLER
        ? user.id
        : user.role === UserRole.CASHIER && user.staffShop
          ? user.staffShop.userId
          : null;
    return { ...user, effectiveSellerId };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.phone !== undefined && { phone: dto.phone || null }),
      },
    });
    return this.getProfile(userId);
  }
}
