import { Injectable, BadRequestException } from '@nestjs/common';
import { MarketplaceMode } from '@prisma/client';
import { getPlatformMarketplaceMode } from '../common/platform-settings-compat';
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

  private async isSingleShopMode(): Promise<boolean> {
    const mode = await getPlatformMarketplaceMode(this.prisma);
    return mode === MarketplaceMode.SINGLE_SHOP;
  }

  /** Admin tasdiqlashisiz: doʻkon yaratish + SELLER rol (yakka doʻkon rejimi) */
  private async autoApproveSellerApplication(applicationId: string): Promise<void> {
    const app = await this.prisma.sellerApplication.findUnique({
      where: { id: applicationId },
      include: { user: true },
    });
    if (!app || app.status !== 'PENDING') return;

    let slug = app.shopName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'shop';
    const existingSlug = await this.prisma.shop.findUnique({ where: { slug } });
    if (existingSlug) {
      let suffix = 1;
      while (await this.prisma.shop.findUnique({ where: { slug: `${slug}-${suffix}` } })) suffix += 1;
      slug = `${slug}-${suffix}`;
    }
    const appAny = app as {
      legalType?: string | null;
      legalName?: string | null;
      ogrn?: string | null;
      inn?: string | null;
      documentUrls?: string[] | null;
    };
    await this.prisma.$transaction(async (tx) => {
      await tx.shop.create({
        data: {
          userId: app.userId,
          name: app.shopName,
          slug,
          description: app.description ?? null,
          legalType: appAny.legalType ?? undefined,
          legalName: appAny.legalName ?? undefined,
          ogrn: appAny.ogrn ?? undefined,
          inn: appAny.inn ?? undefined,
          documentUrls: Array.isArray(appAny.documentUrls) ? appAny.documentUrls : undefined,
        },
      });
      await tx.user.update({
        where: { id: app.userId },
        data: { role: 'SELLER' },
      });
      await tx.sellerApplication.update({
        where: { id: applicationId },
        data: { status: 'APPROVED', reviewedAt: new Date(), reviewedById: null },
      });
    });
  }

  async apply(userId: string, dto: ApplySellerDto) {
    const singleShop = await this.isSingleShopMode();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) throw new BadRequestException('User not found');
    if (user.role === 'SELLER') throw new BadRequestException('Siz allaqachon sotuvchisiz.');
    if (user.role === 'ADMIN' || user.role === 'ADMIN_MODERATOR') {
      throw new BadRequestException('Admin uchun ariza kerak emas.');
    }

    if (singleShop) {
      const myShop = await this.prisma.shop.findFirst({ where: { userId } });
      if (!myShop) {
        const shopCount = await this.prisma.shop.count();
        if (shopCount >= 1) {
          throw new BadRequestException(
            'Platform yakka doʻkon rejimida. Ikkinchi sotuvchi qoʻshilmaydi. Mavjud doʻkon egasi bilan bogʻlaning yoki administratorga murojaat qiling.',
          );
        }
      }
    }

    const existing = await this.prisma.sellerApplication.findUnique({
      where: { userId },
    });
    if (existing) {
      if (existing.status === 'PENDING') {
        if (singleShop) {
          await this.autoApproveSellerApplication(existing.id);
          return this.getMyStatus(userId);
        }
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
      if (!singleShop) {
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
      } else {
        await this.autoApproveSellerApplication(existing.id);
      }
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
    if (!singleShop) {
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
    } else {
      await this.autoApproveSellerApplication(created.id);
    }
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
