import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { ApplySellerDto } from './dto/apply-seller.dto';

@Injectable()
export class SellerApplicationService {
  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
    private notifications: NotificationsService,
  ) {}

  async apply(userId: string, dto: ApplySellerDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) throw new BadRequestException('User not found');
    if (user.role === 'SELLER') throw new BadRequestException('Siz allaqachon sotuvchisiz.');
    if (user.role === 'ADMIN' || user.role === 'ADMIN_MODERATOR') {
      throw new BadRequestException('Admin uchun ariza kerak emas.');
    }

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
      await this.prisma.sellerApplication.update({
        where: { id: existing.id },
        data: {
          shopName: dto.shopName.trim(),
          description: dto.description?.trim() ?? null,
          message: dto.message?.trim() ?? null,
          legalType: dto.legalType?.trim() || null,
          legalName: dto.legalName?.trim() || null,
          ogrn: dto.ogrn?.trim() || null,
          inn: dto.inn?.trim() || null,
          documentUrls: Array.isArray(dto.documentUrls) ? dto.documentUrls : undefined,
          status: 'PENDING',
          rejectReason: null,
          reviewedAt: null,
          reviewedById: null,
        },
      });
      this.notifyAdminNewApplication(existing.id).catch(() => {});
      this.notifications
        .createForAdmins({
          type: 'NEW_SELLER_APPLICATION',
          title: 'Yangi sotuvchi arizasi',
          body: `${dto.shopName} — koʻrib chiqish kutilmoqda`,
          link: '/admin/seller-applications',
          entityId: existing.id,
        })
        .catch(() => {});
      return this.getMyStatus(userId);
    }

    const created = await this.prisma.sellerApplication.create({
      data: {
        userId,
        shopName: dto.shopName.trim(),
        description: dto.description?.trim() ?? null,
        message: dto.message?.trim() ?? null,
        legalType: dto.legalType?.trim() || null,
        legalName: dto.legalName?.trim() || null,
        ogrn: dto.ogrn?.trim() || null,
        inn: dto.inn?.trim() || null,
        documentUrls: Array.isArray(dto.documentUrls) ? dto.documentUrls : undefined,
        status: 'PENDING',
      },
    });
    this.notifyAdminNewApplication(created.id).catch(() => {});
    this.notifications
      .createForAdmins({
        type: 'NEW_SELLER_APPLICATION',
        title: 'Yangi sotuvchi arizasi',
        body: `${dto.shopName} — koʻrib chiqish kutilmoqda`,
        link: '/admin/seller-applications',
        entityId: created.id,
      })
      .catch(() => {});
    return this.getMyStatus(userId);
  }

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

  async getMyStatus(userId: string) {
    const app = await this.prisma.sellerApplication.findUnique({
      where: { userId },
      select: {
        id: true,
        shopName: true,
        description: true,
        message: true,
        legalType: true,
        legalName: true,
        ogrn: true,
        inn: true,
        documentUrls: true,
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
