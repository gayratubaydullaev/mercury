import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import type { ApplySellerDto } from './dto/apply-seller.dto';

@Injectable()
export class SellerApplicationService {
  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
  ) {}

  /** Подать заявку на продавца (только BUYER, одна активная заявка). */
  async apply(userId: string, dto: ApplySellerDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) throw new BadRequestException('User not found');
    if (user.role === 'SELLER') throw new BadRequestException('Siz allaqachon sotuvchisiz.');
    if (user.role === 'ADMIN') throw new BadRequestException('Admin uchun ariza kerak emas.');

    const existing = await this.prisma.sellerApplication.findUnique({
      where: { userId },
    });
    if (existing) {
      if (existing.status === 'PENDING') {
        throw new BadRequestException('Arizangiz ko‘rib chiqilmoqda. Kuting yoki admin bilan bog‘laning.');
      }
      if (existing.status === 'APPROVED') {
        throw new BadRequestException('Arizangiz allaqachon qabul qilingan.');
      }
      // REJECTED — разрешаем подать заново, обновляем запись
      await this.prisma.sellerApplication.update({
        where: { id: existing.id },
        data: {
          shopName: dto.shopName.trim(),
          description: dto.description?.trim() ?? null,
          message: dto.message?.trim() ?? null,
          status: 'PENDING',
          rejectReason: null,
          reviewedAt: null,
          reviewedById: null,
        },
      });
      this.notifyAdminNewApplication(existing.id).catch(() => {});
      return this.getMyStatus(userId);
    }

    const created = await this.prisma.sellerApplication.create({
      data: {
        userId,
        shopName: dto.shopName.trim(),
        description: dto.description?.trim() ?? null,
        message: dto.message?.trim() ?? null,
        status: 'PENDING',
      },
    });
    this.notifyAdminNewApplication(created.id).catch(() => {});
    return this.getMyStatus(userId);
  }

  /** Отправить админу уведомление в Telegram о новой заявке (с кнопками Tasdiqlash / Rad etish). */
  private async notifyAdminNewApplication(applicationId: string): Promise<void> {
    const app = await this.prisma.sellerApplication.findUnique({
      where: { id: applicationId },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    if (!app || app.status !== 'PENDING') return;
    const userName = app.user ? `${app.user.firstName} ${app.user.lastName}`.trim() || '—' : '—';
    await this.telegram.sendAdminNewSellerApplicationNotification({
      applicationId: app.id,
      shopName: app.shopName,
      userName,
      message: app.message ?? undefined,
    });
  }

  /** Статус заявки текущего пользователя. */
  async getMyStatus(userId: string) {
    const app = await this.prisma.sellerApplication.findUnique({
      where: { userId },
      select: {
        id: true,
        shopName: true,
        description: true,
        message: true,
        status: true,
        rejectReason: true,
        createdAt: true,
        reviewedAt: true,
      },
    });
    if (!app) return { application: null, canApply: true };
    return {
      application: app,
      canApply: app.status === 'REJECTED',
    };
  }
}
