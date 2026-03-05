import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as TelegramBotModule from 'node-telegram-bot-api';

// node-telegram-bot-api is CJS: module.exports = TelegramBot — no .default at runtime
const TelegramBot = (TelegramBotModule as { default?: typeof TelegramBotModule }).default ?? TelegramBotModule;

const LINK_CODE_EXPIRE_MS = 15 * 60 * 1000;
const LINK_CODE_LENGTH = 6;

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < LINK_CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function statusToLabel(s: string): string {
  const map: Record<string, string> = {
    PENDING: 'Kutilmoqda',
    CONFIRMED: 'Tasdiqlandi',
    PROCESSING: 'Qayta ishlanmoqda',
    SHIPPED: 'Yuborildi',
    DELIVERED: 'Yetkazildi',
    CANCELLED: 'Bekor qilindi',
  };
  return map[s] ?? s;
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Вариант опцияларини o'qilishi oson matnga aylantiradi (JSON o'rniga). */
function formatVariantOptions(options: Record<string, string> | unknown): string {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return '';
  const entries = Object.entries(options as Record<string, string>).filter(([, v]) => v != null && String(v).trim() !== '');
  if (entries.length === 0) return '';
  return entries.map(([k, v]) => `${k}: ${v}`).join(', ');
}

function canChangeStatus(current: string): boolean {
  return !['DELIVERED', 'CANCELLED'].includes(current);
}

function orderStatusKeyboard(orderId: string, currentStatus: string): TelegramBotModule.InlineKeyboardMarkup {
  const buttons: TelegramBotModule.InlineKeyboardButton[] = [];
  if (currentStatus === 'PENDING') {
    buttons.push({ text: '✓ Tasdiqlash', callback_data: `order:${orderId}:CONFIRMED`, style: 'success' as const });
    buttons.push({ text: '✕ Bekor qilish', callback_data: `order:${orderId}:CANCELLED`, style: 'danger' as const });
  }
  if (currentStatus === 'CONFIRMED') {
    buttons.push({ text: 'Qayta ishlash', callback_data: `order:${orderId}:PROCESSING`, style: 'primary' as const });
    buttons.push({ text: '✕ Bekor qilish', callback_data: `order:${orderId}:CANCELLED`, style: 'danger' as const });
  }
  if (currentStatus === 'PROCESSING') {
    buttons.push({ text: 'Yuborildi', callback_data: `order:${orderId}:SHIPPED`, style: 'primary' as const });
  }
  if (currentStatus === 'SHIPPED') {
    buttons.push({ text: '✓ Yetkazildi', callback_data: `order:${orderId}:DELIVERED`, style: 'success' as const });
  }
  if (buttons.length === 0) return { inline_keyboard: [] };
  return { inline_keyboard: [buttons] };
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private bot: InstanceType<typeof TelegramBot> | null = null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (token) {
      this.bot = new TelegramBot(token, { polling: false });
    }
  }

  getBaseUrl(): string {
    const url = this.config.get<string>('APP_URL')?.trim();
    return url ? url.replace(/\/$/, '') : '';
  }

  async sendMessage(
    chatId: string,
    text: string,
    options?: { parse_mode?: 'HTML' | 'Markdown'; reply_markup?: TelegramBotModule.InlineKeyboardMarkup },
  ): Promise<boolean> {
    if (!this.bot) return false;
    try {
      await this.bot.sendMessage(chatId, text, options);
      return true;
    } catch (e) {
      this.logger.warn(`Telegram sendMessage to ${chatId} failed: ${(e as Error).message}`);
      return false;
    }
  }

  /**
   * Sends order notification only to the shop that owns this order.
   * Resolution: sellerId → shop (by userId) → telegramChatId. Each seller has one shop, so no mix-up.
   */
  async sendOrderNotification(
    sellerId: string,
    order: {
      id: string;
      orderNumber: string;
      status: string;
      totalAmount: { toString(): string };
      createdAt: Date;
      items?: Array<{ product: { title: string }; quantity: number; price: { toString(): string } }>;
      buyer?: { firstName: string; lastName: string } | null;
      guestPhone?: string | null;
      guestEmail?: string | null;
    },
    event: 'new_order' | 'status_updated',
    newStatus?: string,
  ): Promise<void> {
    const shop = await this.prisma.shop.findFirst({
      where: { userId: sellerId },
      select: { telegramChatId: true },
    });
    if (!shop?.telegramChatId) return; // only this seller's chat, no broadcast

    const baseUrl = this.getBaseUrl();
    const amount = Number(order.totalAmount).toLocaleString('uz-UZ');
    const buyerName =
      order.buyer
        ? `${order.buyer.firstName} ${order.buyer.lastName}`
        : order.guestPhone || order.guestEmail || 'Mehmon';
    const itemsText =
      order.items
        ?.slice(0, 5)
        .map((i) => `  • ${escapeHtml(i.product.title)} × ${i.quantity} — ${Number(i.price).toLocaleString('uz-UZ')} soʻm`)
        .join('\n') ?? '';

    let text: string;
    if (event === 'new_order') {
      text =
        '🆕 <b>Yangi buyurtma</b>\n\n' +
        `📋 Raqam: <code>${escapeHtml(order.orderNumber)}</code>\n` +
        `👤 Xaridor: ${escapeHtml(buyerName)}\n` +
        `💰 Jami: ${amount} soʻm\n` +
        `📅 Sana: ${new Date(order.createdAt).toLocaleString('uz-UZ')}\n\n` +
        `<b>Mahsulotlar:</b>\n${itemsText}` +
        (order.items && order.items.length > 5 ? `\n  ... va yana ${order.items.length - 5} ta` : '');
    } else {
      const statusLabel = statusToLabel(newStatus ?? order.status);
      text =
        '📢 <b>Buyurtma yangilandi</b>\n\n' +
        `📋 Raqam: <code>${escapeHtml(order.orderNumber)}</code>\n` +
        `📌 Holat: ${escapeHtml(statusLabel)}\n` +
        `💰 Jami: ${amount} soʻm\n` +
        `👤 Xaridor: ${escapeHtml(buyerName)}`;
    }

    const rows: TelegramBotModule.InlineKeyboardButton[][] = [];
    if (event === 'new_order' || (event === 'status_updated' && canChangeStatus(order.status))) {
      const kb = orderStatusKeyboard(order.id, order.status);
      if (kb.inline_keyboard[0]?.length) rows.push(kb.inline_keyboard[0]);
    }
    const bottomRow: TelegramBotModule.InlineKeyboardButton[] = [];
    bottomRow.push({ text: '📄 Batafsil', callback_data: `order_detail:${order.id}`, style: 'primary' as const });
    if (baseUrl) bottomRow.push({ text: '📋 Buyurtmalar', url: `${baseUrl}/seller/orders`, style: 'primary' as const });
    rows.push(bottomRow);
    const replyMarkup = rows.length > 0 ? { inline_keyboard: rows } : undefined;

    await this.sendMessage(shop.telegramChatId, text, { parse_mode: 'HTML', reply_markup: replyMarkup });
  }

  /**
   * Xaridor (buyer) ga: buyurtma yaratilganda yoki holat o'zgarganda.
   * Faqat agar foydalanuvchi Telegram orqali kirgan bo'lsa (user.telegramId to'ldirilgan).
   */
  async sendBuyerOrderNotification(
    buyerId: string,
    order: {
      id: string;
      orderNumber: string;
      status: string;
      totalAmount: { toString(): string };
      createdAt: Date;
      items?: Array<{ product: { title: string }; quantity: number; price: { toString(): string } }>;
      seller?: { firstName: string; lastName: string; shop?: { name: string } | null } | null;
    },
    event: 'new_order' | 'status_updated',
    newStatus?: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: buyerId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- User.telegramId in schema
      select: { telegramId: true } as any,
    });
    const telegramChatId = (user as { telegramId?: string | null } | null)?.telegramId;
    if (!telegramChatId) return;

    const baseUrl = this.getBaseUrl();
    const amount = Number(order.totalAmount).toLocaleString('uz-UZ');
    const sellerName =
      order.seller?.shop?.name
        ? order.seller.shop.name
        : order.seller
          ? `${order.seller.firstName} ${order.seller.lastName}`
          : '—';
    const itemsText =
      order.items
        ?.slice(0, 5)
        .map((i) => `  • ${escapeHtml(i.product.title)} × ${i.quantity} — ${Number(i.price).toLocaleString('uz-UZ')} soʻm`)
        .join('\n') ?? '';

    let text: string;
    if (event === 'new_order') {
      text =
        '✅ <b>Buyurtmangiz qabul qilindi</b>\n\n' +
        `📋 Raqam: <code>${escapeHtml(order.orderNumber)}</code>\n` +
        `🏪 Sotuvchi: ${escapeHtml(sellerName)}\n` +
        `💰 Jami: ${amount} soʻm\n` +
        `📅 Sana: ${new Date(order.createdAt).toLocaleString('uz-UZ')}\n\n` +
        `<b>Mahsulotlar:</b>\n${itemsText}` +
        (order.items && order.items.length > 5 ? `\n  ... va yana ${order.items.length - 5} ta` : '');
    } else {
      const statusLabel = statusToLabel(newStatus ?? order.status);
      text =
        '📢 <b>Buyurtmangiz yangilandi</b>\n\n' +
        `📋 Raqam: <code>${escapeHtml(order.orderNumber)}</code>\n` +
        `📌 Yangi holat: ${escapeHtml(statusLabel)}\n` +
        `💰 Jami: ${amount} soʻm\n` +
        `🏪 Sotuvchi: ${escapeHtml(sellerName)}`;
    }

    const rows: TelegramBotModule.InlineKeyboardButton[][] = [];
    if (baseUrl) {
      rows.push([{ text: '📋 Mening buyurtmalarim', url: `${baseUrl}/orders`, style: 'primary' as const }]);
    }
    const replyMarkup = rows.length > 0 ? { inline_keyboard: rows } : undefined;
    await this.sendMessage(telegramChatId, text, { parse_mode: 'HTML', reply_markup: replyMarkup });
  }

  async createLinkCode(chatId: string): Promise<string> {
    await this.prisma.telegramLinkCode.deleteMany({ where: { chatId } });
    const code = generateCode();
    await this.prisma.telegramLinkCode.create({ data: { code, chatId } });
    return code;
  }

  async resolveLinkCode(code: string): Promise<string | null> {
    const normalized = code.trim().toUpperCase();
    const row = await this.prisma.telegramLinkCode.findUnique({ where: { code: normalized } });
    if (!row) return null;
    const age = Date.now() - row.createdAt.getTime();
    if (age > LINK_CODE_EXPIRE_MS) {
      await this.prisma.telegramLinkCode.delete({ where: { id: row.id } });
      return null;
    }
    await this.prisma.telegramLinkCode.delete({ where: { id: row.id } });
    return row.chatId;
  }

  async cleanupExpiredCodes(): Promise<void> {
    const cutoff = new Date(Date.now() - LINK_CODE_EXPIRE_MS);
    await this.prisma.telegramLinkCode.deleteMany({ where: { createdAt: { lt: cutoff } } });
  }

  /**
   * Admin: to'liq buyurtma ma'lumotlari — xaridor, sotuvchi, manzil, to'lov, mahsulotlar.
   */
  async sendAdminOrderNotification(
    order: {
      id?: string;
      orderNumber: string;
      status: string;
      paymentStatus?: string;
      paymentMethod?: string;
      deliveryType?: string;
      totalAmount: { toString(): string };
      shippingAddress?: unknown;
      notes?: string | null;
      createdAt: Date;
      buyer?: { firstName: string; lastName: string; email?: string; phone?: string | null } | null;
      guestPhone?: string | null;
      guestEmail?: string | null;
      seller?: { firstName: string; lastName: string; shop?: { name: string } | null } | null;
      items?: Array<{
        product: { title: string };
        variant?: { options?: unknown } | null;
        quantity: number;
        price: { toString(): string };
      }>;
    },
    event: 'new_order' | 'status_updated',
    newStatus?: string,
  ): Promise<void> {
    const settings = await this.prisma.platformSettings.findFirst({
      select: { adminTelegramChatId: true },
    });
    if (!settings?.adminTelegramChatId) return;

    const amount = Number(order.totalAmount).toLocaleString('uz-UZ');
    const buyerName = order.buyer
      ? `${order.buyer.firstName} ${order.buyer.lastName}`
      : order.guestPhone || order.guestEmail || 'Mehmon';
    const buyerContact =
      order.buyer
        ? [order.buyer.email, order.buyer.phone].filter(Boolean).join(', ') || '—'
        : [order.guestEmail, order.guestPhone].filter(Boolean).join(', ') || '—';
    const sellerName = order.seller
      ? `${order.seller.firstName} ${order.seller.lastName}${order.seller.shop ? ` (${order.seller.shop.name})` : ''}`
      : '—';
    const addr =
      order.shippingAddress && typeof order.shippingAddress === 'object'
        ? Object.entries(order.shippingAddress as Record<string, unknown>)
            .filter(([, v]) => v != null && String(v).trim() !== '')
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ') || '—'
        : '—';
    const itemsLines =
      order.items
        ?.map(
          (i) =>
            `  • ${i.product.title}${i.variant?.options ? ` (${formatVariantOptions(i.variant.options)})` : ''} × ${i.quantity} = ${Number(i.price).toLocaleString('uz-UZ')} soʻm`,
        )
        .join('\n') ?? '—';

    const statusLabel = statusToLabel(newStatus ?? order.status);
    const header =
      event === 'new_order'
        ? '📦 <b>ADMIN: Yangi buyurtma</b>'
        : `📢 <b>ADMIN: Buyurtma yangilandi</b> → ${escapeHtml(statusLabel)}`;

    const text =
      `${header}\n\n` +
      `📋 Raqam: <code>${escapeHtml(order.orderNumber)}</code>\n` +
      `📌 Holat: ${escapeHtml(statusToLabel(order.status))}${newStatus ? ` → ${escapeHtml(statusLabel)}` : ''}\n` +
      `💳 To'lov: ${escapeHtml(order.paymentStatus ?? '—')} (${escapeHtml(order.paymentMethod ?? '—')})\n` +
      `🚚 Yetkazish: ${escapeHtml(order.deliveryType ?? '—')}\n` +
      `💰 Jami: ${amount} soʻm\n` +
      `📅 Sana: ${new Date(order.createdAt).toLocaleString('uz-UZ')}\n\n` +
      `👤 Xaridor: ${escapeHtml(buyerName)}\n` +
      `📞 Aloqa: ${escapeHtml(buyerContact)}\n` +
      `🏪 Sotuvchi: ${escapeHtml(sellerName)}\n` +
      `📍 Manzil: ${escapeHtml(addr)}\n` +
      (order.notes ? `📝 Izoh: ${escapeHtml(order.notes)}\n` : '') +
      `\n<b>Mahsulotlar:</b>\n${itemsLines.split('\n').map((l) => escapeHtml(l)).join('\n')}`;

    const baseUrl = this.getBaseUrl();
    const adminRows: TelegramBotModule.InlineKeyboardButton[][] = [];
    if (order.id) adminRows.push([{ text: '📄 Batafsil', callback_data: `admin_order_detail:${order.id}`, style: 'primary' as const }]);
    if (baseUrl) adminRows.push([{ text: '📋 Buyurtmalar', url: `${baseUrl}/admin/orders`, style: 'primary' as const }]);
    const replyMarkup = adminRows.length > 0 ? { inline_keyboard: adminRows } : undefined;
    await this.sendMessage(settings.adminTelegramChatId, text, { parse_mode: 'HTML', reply_markup: replyMarkup });
  }

  /** Sotuvchiga: yangi sharh yozilganda */
  async sendSellerReviewNotification(
    sellerId: string,
    data: { rating: number; comment: string | null; productTitle: string; userName: string },
  ): Promise<void> {
    const shop = await this.prisma.shop.findFirst({
      where: { userId: sellerId },
      select: { telegramChatId: true },
    });
    if (!shop?.telegramChatId) return;
    const stars = '⭐'.repeat(data.rating) + '☆'.repeat(5 - data.rating);
    const text =
      '💬 <b>Yangi sharh</b>\n\n' +
      `📦 ${escapeHtml(data.productTitle)}\n` +
      `👤 ${escapeHtml(data.userName)}\n` +
      `${stars}\n` +
      (data.comment ? `\n${escapeHtml(data.comment.slice(0, 300))}${data.comment.length > 300 ? '…' : ''}` : '');
    const baseUrl = this.getBaseUrl();
    const replyMarkup = baseUrl
      ? { inline_keyboard: [[{ text: '📋 Sharhlar', url: `${baseUrl}/seller/reviews`, style: 'primary' as const }]] }
      : undefined;
    await this.sendMessage(shop.telegramChatId, text, { parse_mode: 'HTML', reply_markup: replyMarkup });
  }

  /** Admin: yangi mahsulot moderatsiya kutilmoqda */
  async sendAdminPendingProductNotification(product: { id: string; title: string; shop?: { name: string } | null }): Promise<void> {
    const settings = await this.prisma.platformSettings.findFirst({ select: { adminTelegramChatId: true } });
    if (!settings?.adminTelegramChatId) return;
    const text =
      '📦 <b>ADMIN: Yangi mahsulot (moderatsiya kutilmoqda)</b>\n\n' +
      `ID: <code>${escapeHtml(product.id)}</code>\n` +
      `Nomi: ${escapeHtml(product.title)}\n` +
      `Doʻkon: ${product.shop?.name ? escapeHtml(product.shop.name) : '—'}`;
    const baseUrl = this.getBaseUrl();
    const replyMarkup = baseUrl
      ? { inline_keyboard: [[{ text: '📦 Moderatsiya', url: `${baseUrl}/admin/products?filter=pending`, style: 'primary' as const }]] }
      : undefined;
    await this.sendMessage(settings.adminTelegramChatId, text, { parse_mode: 'HTML', reply_markup: replyMarkup });
  }

  /** Admin: yangi ariza — sotuvchi bo'lish (tasdiqlash/rad etish tugmalari orqali). */
  async sendAdminNewSellerApplicationNotification(data: {
    applicationId: string;
    shopName: string;
    userName: string;
    message?: string | null;
  }): Promise<void> {
    const settings = await this.prisma.platformSettings.findFirst({ select: { adminTelegramChatId: true } });
    if (!settings?.adminTelegramChatId) return;
    const text =
      '📝 <b>Yangi ariza: Sotuvchi bo\'lish</b>\n\n' +
      `🏪 Doʻkon nomi: ${escapeHtml(data.shopName)}\n` +
      `👤 Ariza: ${escapeHtml(data.userName)}\n` +
      (data.message ? `\n💬 Xabar: ${escapeHtml(data.message.slice(0, 300))}${data.message.length > 300 ? '…' : ''}` : '');
    const baseUrl = this.getBaseUrl();
    const rows: { text: string; callback_data?: string; url?: string }[][] = [
      [
        { text: '✅ Tasdiqlash', callback_data: `seller_app:approve:${data.applicationId}` },
        { text: '❌ Rad etish', callback_data: `seller_app:reject:${data.applicationId}` },
      ],
    ];
    if (baseUrl) {
      rows.push([{ text: '📋 Arizalar roʻyxati', url: `${baseUrl}/admin/seller-applications` }]);
    }
    await this.sendMessage(settings.adminTelegramChatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
  }

  /** Admin: yangi sharh moderatsiya kutilmoqda */
  async sendAdminPendingReviewNotification(data: {
    id: string;
    rating: number;
    comment: string | null;
    productTitle: string;
    userName: string;
  }): Promise<void> {
    const settings = await this.prisma.platformSettings.findFirst({ select: { adminTelegramChatId: true } });
    if (!settings?.adminTelegramChatId) return;
    const stars = '⭐'.repeat(data.rating) + '☆'.repeat(5 - data.rating);
    const text =
      '💬 <b>ADMIN: Yangi sharh (moderatsiya kutilmoqda)</b>\n\n' +
      `📦 ${escapeHtml(data.productTitle)}\n` +
      `👤 ${escapeHtml(data.userName)} ${stars}\n` +
      (data.comment ? `\n${escapeHtml(data.comment.slice(0, 200))}${data.comment.length > 200 ? '…' : ''}` : '');
    const baseUrl = this.getBaseUrl();
    const replyMarkup = baseUrl
      ? { inline_keyboard: [[{ text: '💬 Sharhlar', url: `${baseUrl}/admin/reviews?filter=pending`, style: 'primary' as const }]] }
      : undefined;
    await this.sendMessage(settings.adminTelegramChatId, text, { parse_mode: 'HTML', reply_markup: replyMarkup });
  }
}
