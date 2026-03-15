import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationType =
  | 'NEW_ORDER'
  | 'NEW_SELLER_APPLICATION'
  | 'PENDING_PRODUCT'
  | 'NEW_REVIEW'
  | 'NEW_CHAT_MESSAGE'
  | 'PENDING_SHOP_UPDATE';

export interface CreateNotificationDto {
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  entityId?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async createForUser(userId: string, dto: CreateNotificationDto) {
    await this.prisma.notification.create({
      data: {
        userId,
        type: dto.type,
        title: dto.title,
        body: dto.body ?? null,
        link: dto.link ?? null,
        entityId: dto.entityId ?? null,
      },
    });
  }

  async createForAdmins(dto: CreateNotificationDto) {
    const admins = await this.prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'ADMIN_MODERATOR'] } },
      select: { id: true },
    });
    if (admins.length === 0) return;
    await this.prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: dto.type,
        title: dto.title,
        body: dto.body ?? null,
        link: dto.link ?? null,
        entityId: dto.entityId ?? null,
      })),
    });
  }

  async getForUser(userId: string, page = 1, limit = 20) {
    const skip = Math.max(0, (page - 1) * limit);
    const take = Math.min(50, Math.max(1, limit));
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          link: true,
          entityId: true,
          readAt: true,
          createdAt: true,
        },
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
    return {
      data,
      total,
      page,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    const n = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: { userId: true },
    });
    if (!n) throw new NotFoundException('Notification not found');
    if (n.userId !== userId) throw new ForbiddenException();
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
