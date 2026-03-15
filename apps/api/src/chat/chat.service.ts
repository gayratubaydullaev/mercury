import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private async isPlatformChatWithSellerEnabled(): Promise<boolean> {
    const settings = await this.prisma.platformSettings.findFirst({ select: { chatWithSellerEnabled: true } });
    return settings?.chatWithSellerEnabled ?? true;
  }

  private async isSellerChatEnabled(sellerId: string): Promise<boolean> {
    const shop = await this.prisma.shop.findFirst({ where: { userId: sellerId }, select: { chatEnabled: true } });
    return shop?.chatEnabled ?? true;
  }

  async getOrCreateSession(buyerId: string, sellerId: string, productId?: string) {
    if (buyerId === sellerId) throw new ForbiddenException('Cannot chat with yourself');
    const platformEnabled = await this.isPlatformChatWithSellerEnabled();
    if (!platformEnabled) {
      throw new ForbiddenException('Chat xaridor–sotuvchi hozircha platforma administratori tomonidan o‘chirilgan');
    }
    const chatEnabled = await this.isSellerChatEnabled(sellerId);
    if (!chatEnabled) {
      throw new ForbiddenException('Sotuvchi hozircha xabarlarni qabul qilmaydi');
    }
    let session = await this.prisma.chatSession.findFirst({
      where: { buyerId, sellerId, productId: productId ?? null },
      include: { messages: { orderBy: { createdAt: 'asc' } }, product: true },
    });
    if (!session) {
      session = await this.prisma.chatSession.create({
        data: { buyerId, sellerId, productId },
        include: { messages: true, product: true },
      });
    }
    return session;
  }

  async getMySessions(userId: string, asBuyer: boolean) {
    const where = asBuyer ? { buyerId: userId } : { sellerId: userId };
    return this.prisma.chatSession.findMany({
      where,
      include: {
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
        buyer: { select: { firstName: true, lastName: true } },
        seller: { select: { firstName: true, lastName: true } },
        product: { select: { title: true, slug: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getSession(sessionId: string, userId: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        buyer: { select: { id: true, firstName: true, lastName: true } },
        seller: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            shop: { select: { chatEnabled: true } },
          },
        },
        product: { select: { id: true, title: true, slug: true } },
      },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.buyerId !== userId && session.sellerId !== userId) throw new ForbiddenException();
    const chatWithSellerEnabled = await this.isPlatformChatWithSellerEnabled();
    return { ...session, chatWithSellerEnabled };
  }

  async sendMessage(sessionId: string, senderId: string, content: string) {
    const session = await this.prisma.chatSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    if (session.buyerId !== senderId && session.sellerId !== senderId) throw new ForbiddenException();
    if (!content?.trim()) throw new ForbiddenException('Content is required');
    if (session.buyerId === senderId) {
      const platformEnabled = await this.isPlatformChatWithSellerEnabled();
      if (!platformEnabled) throw new ForbiddenException('Chat xaridor–sotuvchi hozircha platforma administratori tomonidan o‘chirilgan');
      const chatEnabled = await this.isSellerChatEnabled(session.sellerId);
      if (!chatEnabled) throw new ForbiddenException('Sotuvchi hozircha xabarlarni qabul qilmaydi');
    }
    await this.prisma.chatSession.update({ where: { id: sessionId }, data: { updatedAt: new Date() } });
    const message = await this.prisma.chatMessage.create({
      data: { sessionId, senderId, content: content.trim() },
      include: { sender: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (session.buyerId === senderId) {
      this.notifications
        .createForUser(session.sellerId, {
          type: 'NEW_CHAT_MESSAGE',
          title: 'Yangi xabar',
          body: message.content.slice(0, 80) + (message.content.length > 80 ? '…' : ''),
          link: '/chat',
          entityId: sessionId,
        })
        .catch(() => {});
    }
    return message;
  }

  async getMessages(sessionId: string, userId: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.buyerId !== userId && session.sellerId !== userId) throw new ForbiddenException();
    return session.messages;
  }
}
