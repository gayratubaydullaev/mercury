import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { TelegramService } from './telegram.service';
import * as TelegramBotModule from 'node-telegram-bot-api';

const TelegramBot = (TelegramBotModule as { default?: typeof TelegramBotModule }).default ?? TelegramBotModule;
import { OrderStatus, Prisma } from '@prisma/client';

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatVariantOptions(options: Record<string, string> | unknown): string {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return '';
  const entries = Object.entries(options as Record<string, string>).filter(([, v]) => v != null && String(v).trim() !== '');
  if (entries.length === 0) return '';
  return entries.map(([k, v]) => `${k}: ${v}`).join(', ');
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Kutilmoqda',
  CONFIRMED: 'Zakazingiz qabul qilindi',
  PROCESSING: 'Tayyorlanmoqda',
  SHIPPED: 'Yuborildi',
  DELIVERED: 'Yetkazildi',
  CANCELLED: 'Bekor qilindi',
};
function getOrderStatusLabel(status: string, deliveryType?: string): string {
  if (deliveryType === 'PICKUP') {
    if (status === 'SHIPPED') return 'Olib ketishga tayyor';
    if (status === 'DELIVERED') return 'Berildi (Olib ketildi)';
  }
  return STATUS_LABELS[status] ?? status;
}
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Kutilmoqda',
  PAID: "To'langan",
  FAILED: 'Muvaffaqiyatsiz',
  REFUNDED: 'Qaytarilgan',
};
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CLICK: 'Click',
  PAYME: 'Payme',
  CASH: 'Naqd',
  CARD_ON_DELIVERY: 'Karta (yetkazishda)',
};
const DELIVERY_TYPE_LABELS: Record<string, string> = {
  DELIVERY: 'Yetkazib berish',
  PICKUP: 'Olib ketish',
};

const MENU_BACK_ROW: TelegramBotModule.InlineKeyboardButton[][] = [
  [{ text: '◀️ Asosiy menyu', callback_data: 'cmd:menu' }],
];

const SELLER_MENU_ROWS: TelegramBotModule.InlineKeyboardButton[][] = [
  [
    { text: '📋 Buyurtmalar', callback_data: 'cmd:orders', style: 'primary' },
    { text: '📊 Statistika', callback_data: 'cmd:stats', style: 'primary' },
  ],
  [
    { text: '📅 Bugun', callback_data: 'cmd:today', style: 'primary' },
    { text: '⏳ Kutilmoqda', callback_data: 'cmd:pending', style: 'success' },
  ],
  [{ text: '❓ Yordam', callback_data: 'cmd:help' }],
  ...MENU_BACK_ROW,
];

function getAdminMenuRows(baseUrl: string | null): TelegramBotModule.InlineKeyboardButton[][] {
  const rows: TelegramBotModule.InlineKeyboardButton[][] = [
    [
      { text: '📋 Buyurtmalar', callback_data: 'cmd:orders', style: 'primary' },
      { text: '📊 Statistika', callback_data: 'cmd:stats', style: 'primary' },
    ],
    [
      { text: '📅 Bugun', callback_data: 'cmd:today', style: 'primary' },
      { text: '⏳ Kutilmoqda', callback_data: 'cmd:pending', style: 'success' },
    ],
  ];
  if (baseUrl) {
    rows.push([
      { text: '📦 Moderatsiya (tovarlar)', url: `${baseUrl}/admin/products?filter=pending`, style: 'primary' },
      { text: '💬 Sharhlar', url: `${baseUrl}/admin/reviews?filter=pending`, style: 'primary' },
    ]);
  }
  rows.push([{ text: '❓ Yordam', callback_data: 'cmd:help' }]);
  rows.push(...MENU_BACK_ROW);
  return rows;
}


function getBuyerMenuRows(webAppUrl: string | null): TelegramBotModule.InlineKeyboardButton[][] {
  const rows: TelegramBotModule.InlineKeyboardButton[][] = [];
  if (webAppUrl) {
    rows.push([{ text: "🛒 Do'kon (katalog, savatcha)", web_app: { url: webAppUrl }, style: 'primary' }]);
  }
  rows.push(
    [
      { text: '📋 Mening buyurtmalarim', callback_data: 'buyer_orders', style: 'primary' },
      { text: '❓ Yordam', callback_data: 'cmd:help' },
    ],
    ...MENU_BACK_ROW,
  );
  return rows;
}

const MAX_MESSAGE_LENGTH = 4096;
function truncateForTelegram(text: string, suffix = '…'): string {
  if (text.length <= MAX_MESSAGE_LENGTH) return text;
  return text.slice(0, MAX_MESSAGE_LENGTH - suffix.length) + suffix;
}

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: InstanceType<typeof TelegramBot> | null = null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private auth: AuthService,
    private telegram: TelegramService,
  ) {}

  onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.log('TELEGRAM_BOT_TOKEN not set, Telegram bot disabled');
      return;
    }
    this.bot = new TelegramBot(token, { polling: true });
    this.bot.on('message', (msg: TelegramBotModule.Message) => this.handleMessage(msg).catch((e) => this.logger.warn(e)));
    this.bot.on('callback_query', (query: TelegramBotModule.CallbackQuery) => this.handleCallback(query).catch((e) => this.logger.warn(e)));
    this.bot.setMyCommands([
      { command: 'start', description: 'Botni ishga tushirish' },
      { command: 'code', description: 'Ulash kodi olish (Admin / Sotuvchi)' },
      { command: 'shop', description: "Do'konni ochish (veb-ilova)" },
      { command: 'orders', description: "Mening buyurtmalarim / Sotuvchi: buyurtmalar" },
      { command: 'help', description: 'Yordam' },
    ]).catch(() => {});

    const baseUrl = this.telegram.getBaseUrl();
    if (baseUrl) {
      const webAppUrl = `${baseUrl.replace(/\/$/, '')}/telegram-app`;
      const setMenu = (this.bot as { setChatMenuButton?: (p: unknown) => Promise<boolean> }).setChatMenuButton;
      if (typeof setMenu === 'function') {
        setMenu.call(this.bot, {
          menu_button: { type: 'web_app', text: "Do'kon (veb)", web_app: { url: webAppUrl } },
        }).then(() => this.logger.log('Telegram Web App menu button set')).catch((e: unknown) => this.logger.warn('setChatMenuButton failed', e));
      }
    }

    this.logger.log('Telegram bot polling started');
  }

  onModuleDestroy() {
    if (this.bot) {
      this.bot.stopPolling();
      this.bot = null;
    }
  }

  private async getAdminTelegramChatId(): Promise<string | null> {
    return this.telegram.getAdminChatId();
  }

  private async getBuyerByTelegramChatId(chatId: string): Promise<{ id: string; firstName: string; lastName: string } | null> {
    const user = await this.prisma.user.findFirst({
      where: { telegramId: chatId },
      select: { id: true, firstName: true, lastName: true },
    });
    return user;
  }

  private async sendOrEdit(
    chatId: string,
    text: string,
    options: { parse_mode?: 'HTML'; reply_markup?: TelegramBotModule.InlineKeyboardMarkup },
    messageId?: number,
  ): Promise<void> {
    const safeText = truncateForTelegram(text);
    if (messageId != null && this.bot) {
      await this.bot.editMessageText(safeText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: options.parse_mode ?? 'HTML',
        reply_markup: options.reply_markup,
      }).catch(() => {
        this.bot!.sendMessage(chatId, safeText, { ...options }).catch((e) => this.logger.warn(e));
      });
    } else if (this.bot) {
      await this.bot.sendMessage(chatId, safeText, options);
    }
  }

  private async getBackMenuRows(chatId: string): Promise<TelegramBotModule.InlineKeyboardButton[][]> {
    const adminChatId = await this.getAdminTelegramChatId();
    if (adminChatId === chatId) return getAdminMenuRows(this.telegram.getBaseUrl());
    return SELLER_MENU_ROWS;
  }

  private async getMenuWithPanel(chatId: string): Promise<TelegramBotModule.InlineKeyboardMarkup> {
    const baseUrl = this.telegram.getBaseUrl();
    const webAppUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/telegram-app` : null;
    const adminChatId = await this.getAdminTelegramChatId();
    const isAdmin = adminChatId === chatId;
    const shop = await this.prisma.shop.findFirst({ where: { telegramChatId: chatId }, select: { id: true } });
    if (isAdmin) {
      const rows: TelegramBotModule.InlineKeyboardButton[][] = [];
      if (webAppUrl) rows.push([{ text: "🛒 Do'kon (veb-ilova)", web_app: { url: webAppUrl }, style: 'primary' }]);
      rows.push(...getAdminMenuRows(baseUrl));
      if (baseUrl) rows.push([{ text: '🌐 Admin panel', url: `${baseUrl}/admin`, style: 'primary' }]);
      return { inline_keyboard: rows };
    }
    if (shop) {
      const rows: TelegramBotModule.InlineKeyboardButton[][] = [];
      if (webAppUrl) rows.push([{ text: "🛒 Do'kon (veb-ilova)", web_app: { url: webAppUrl }, style: 'primary' }]);
      rows.push(...SELLER_MENU_ROWS);
      if (baseUrl) rows.push([{ text: '🌐 Sotuvchi panel', url: `${baseUrl}/seller`, style: 'primary' }]);
      return { inline_keyboard: rows };
    }
    return { inline_keyboard: getBuyerMenuRows(webAppUrl) };
  }

  private async sendMenuResponse(chatId: string, messageId?: number) {
    const menuMarkup = await this.getMenuWithPanel(chatId);
    const text =
      '<b>Oline Bozor bot</b>\n\nQuyidagi tugmalardan foydalaning. Buyurtma xabarida "Batafsil" — toʻliq maʼlumot.';
    await this.sendOrEdit(chatId, text, { parse_mode: 'HTML', reply_markup: menuMarkup }, messageId);
  }

  private async handleMessage(msg: TelegramBotModule.Message) {
    const msgWithCaption = msg as TelegramBotModule.Message & { caption?: string };
    const rawText = (msg.text ?? msgWithCaption.caption ?? '').trim();
    const text = rawText.toLowerCase();
    const chatId = String(msg.chat.id);

    const linkStartMatch = rawText.match(/^\/start\s+link_(.+)$/i);
    if (linkStartMatch) {
      const token = linkStartMatch[1].trim();
      if (token) {
        const linkRow = await this.prisma.telegramLoginToken.findUnique({
          where: { token },
        });
        if (!linkRow || linkRow.expiresAt < new Date()) {
          await this.bot!.sendMessage(
            chatId,
            '⏱ Link muddati tugagan. Saytda "Telegram ulash" tugmasini qayta bosing.',
          );
          return;
        }
        if (!linkRow?.linkUserId) {
          await this.bot!.sendMessage(chatId, 'Bu link kirish uchun. Saytda "Telegram orqali kirish" tugmasidan foydalaning.');
          return;
        }
        await this.prisma.telegramLoginToken.update({
          where: { id: linkRow.id },
          data: { telegramChatId: chatId },
        });
        await this.bot!.sendMessage(
          chatId,
          '✅ Telegram hisobingiz saytdagi hisobingizga ulandi. Endi sayt oynasiga qayting — buyurtmalar haqida xabar olasiz.',
        );
        return;
      }
    }

    const loginStartMatch = rawText.match(/^\/start\s+login_(.+)$/i);
    if (loginStartMatch) {
      const token = loginStartMatch[1].trim();
      if (token) {
        const loginRow = await this.prisma.telegramLoginToken.findUnique({
          where: { token },
        });
        if (!loginRow || loginRow.expiresAt < new Date()) {
          await this.bot!.sendMessage(
            chatId,
            '⏱ Link muddati tugagan. Saytda "Telegram orqali kirish" tugmasini qayta bosing.',
          );
          return;
        }
        await this.prisma.telegramLoginToken.update({
          where: { id: loginRow.id },
          data: { telegramChatId: chatId },
        });
        const from = msg.from as { first_name?: string; last_name?: string } | undefined;
        try {
          await this.auth.findOrCreateUserByTelegramId(
            chatId,
            from?.first_name,
            from?.last_name,
          );
        } catch (e) {
          this.logger.warn('findOrCreateUserByTelegramId failed', e);
          await this.bot!.sendMessage(chatId, 'Xatolik yuz berdi. Qayta urinib koʻring.');
          return;
        }
        await this.bot!.sendMessage(
          chatId,
          '✅ Siz tizimga kirdingiz. Endi sayt oynasiga qayting — avtomatik kirish amalga oshadi.',
        );
        return;
      }
    }

    const adminChatId = await this.getAdminTelegramChatId();
    const isAdmin = adminChatId === chatId;
    const shop = await this.prisma.shop.findFirst({ where: { telegramChatId: chatId }, select: { id: true } });
    const buyer = await this.getBuyerByTelegramChatId(chatId);

    const isCodeCommand =
      text === '/code' || text.startsWith('/code@') || (text.startsWith('/code') && (text.length === 6 || text[6] === ' '));
    if (isCodeCommand) {
      try {
        const code = await this.telegram.createLinkCode(chatId);
        const menuMarkup = await this.getMenuWithPanel(chatId);
        await this.bot!.sendMessage(
          chatId,
          `🔑 <b>Ulash kodi:</b> <code>${code}</code>\n\nSaytda <b>Sozlamalar → Telegram</b> da kiriting. 15 daqiqa amal qiladi.`,
          { parse_mode: 'HTML', reply_markup: menuMarkup },
        );
      } catch (e) {
        this.logger.warn('createLinkCode failed', e);
        await this.bot!.sendMessage(chatId, 'Kod yaratishda xatolik. Keyinroq /code yuboring.');
      }
      return;
    }

    const isStartOrLink = text === '/start' || text === '/link' || text.startsWith('/start@') || text.startsWith('/link@');
    if (isStartOrLink) {
      const menuMarkup = await this.getMenuWithPanel(chatId);
      if (isAdmin) {
        await this.bot!.sendMessage(
          chatId,
          `Assalomu alaykum! <b>Oline Bozor</b> — <b>Admin</b>.\n\nQuyidagi tugmalar: buyurtmalar, statistika, moderatsiya, veb panel. Ulash kodi kerak boʻlsa — <b>/code</b> yuboring.`,
          { parse_mode: 'HTML', reply_markup: menuMarkup },
        );
      } else if (shop) {
        await this.bot!.sendMessage(
          chatId,
          `Assalomu alaykum! <b>Oline Bozor</b> — <b>Sotuvchi</b>.\n\nQuyidagi tugmalar: buyurtmalar, statistika, veb panel. Ulash kodi kerak boʻlsa — <b>/code</b> yuboring.`,
          { parse_mode: 'HTML', reply_markup: menuMarkup },
        );
      } else {
        const welcome =
          buyer
            ? `Salom, ${esc(buyer.firstName)}! <b>Oline Bozor</b> — xaridor.\n\nKatalog, savatcha va buyurtmalar — quyidagi tugma orqali.`
            : `Assalomu alaykum! <b>Oline Bozor</b> doʻkoni.\n\nQuyidagi tugma orqali katalogni oching, xarid qiling. Birinchi ochishda avtomatik roʻyxatdan oʻtasiz.`;
        await this.bot!.sendMessage(
          chatId,
          welcome + '\n\nQuyidagi tugmalardan yoki buyruqlardan foydalaning:',
          { parse_mode: 'HTML', reply_markup: menuMarkup },
        );
      }
      return;
    }

    if (text === '/shop' || text === '/catalog' || text === '/do\'kon') {
      const menuMarkup = await this.getMenuWithPanel(chatId);
      await this.bot!.sendMessage(
        chatId,
        "🛒 Do'kon — katalog, savatcha va buyurtmalar. Quyidagi tugmani bosing:",
        { parse_mode: 'HTML', reply_markup: menuMarkup },
      );
      return;
    }

    if (text === '/orders') {
      if (buyer && !shop && !isAdmin) return this.sendBuyerOrdersResponse(chatId);
      return this.sendOrdersResponse(chatId);
    }
    if (text === '/stats') return this.sendStatsResponse(chatId);
    if (text === '/pending') return this.sendPendingResponse(chatId);
    if (text === '/today') return this.sendTodayResponse(chatId);
    if (text === '/help') return this.sendHelpResponse(chatId, undefined, buyer, shop, isAdmin);

    // Nomaʼlum matn: bitta xabar bilan menyu (buyruqlar yuqorida qaytadi — ikkinchi xabar boʻlmasin)
    const isCommand = text.startsWith('/') || text === 'start' || text === 'link';
    if (text.length > 0 && !isCommand) {
      const menuMarkup = await this.getMenuWithPanel(chatId);
      await this.bot!.sendMessage(
        chatId,
        'Quyidagi tugmalardan yoki buyruqlardan foydalaning:',
        { reply_markup: menuMarkup },
      );
    }
  }

  private async sendOrdersResponse(chatId: string, messageId?: number) {
    const adminChatId = await this.getAdminTelegramChatId();
    if (adminChatId === chatId) {
      const orders = await this.prisma.order.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
        include: { buyer: { select: { firstName: true, lastName: true } }, seller: { select: { shop: { select: { name: true } } } } },
      });
      if (orders.length === 0) {
        await this.sendOrEdit(chatId, '📋 <b>Admin: Buyurtmalar</b>\n\nHali buyurtmalar yoʻq.', { parse_mode: 'HTML', reply_markup: await this.getMenuWithPanel(chatId) }, messageId);
        return;
      }
      const lines = orders.map(
        (o) =>
          `• ${o.orderNumber} — ${getOrderStatusLabel(o.status, o.deliveryType)} — ${Number(o.totalAmount).toLocaleString('uz-UZ')} soʻm`,
      );
      const orderButtons: TelegramBotModule.InlineKeyboardButton[][] = [];
      const forButtons = orders.slice(0, 10);
      for (let i = 0; i < forButtons.length; i += 2) {
        const row: TelegramBotModule.InlineKeyboardButton[] = [];
        row.push({ text: `📄 ${forButtons[i].orderNumber}`, callback_data: `admin_order_detail:${forButtons[i].id}`, style: 'primary' });
        if (forButtons[i + 1]) row.push({ text: `📄 ${forButtons[i + 1].orderNumber}`, callback_data: `admin_order_detail:${forButtons[i + 1].id}`, style: 'primary' });
        orderButtons.push(row);
      }
      const backRows = await this.getBackMenuRows(chatId);
      const reply_markup: TelegramBotModule.InlineKeyboardMarkup = { inline_keyboard: [...orderButtons, ...backRows] };
      await this.sendOrEdit(chatId, '📋 <b>Admin: Soʻnggi buyurtmalar</b>\n\nQuyidagi tugmalardan batafsil oling:\n\n' + lines.join('\n'), { parse_mode: 'HTML', reply_markup }, messageId);
      return;
    }
    const shop = await this.prisma.shop.findFirst({
      where: { telegramChatId: chatId },
      select: { userId: true },
    });
    if (!shop) {
      await this.sendOrEdit(chatId, 'Avval doʻkoningizni ulang: Sozlamalar → Telegram da kodni kiriting.', { reply_markup: await this.getMenuWithPanel(chatId) }, messageId);
      return;
    }
    const orders = await this.prisma.order.findMany({
      where: { sellerId: shop.userId, status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'] } },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { product: { select: { title: true } } } }, buyer: { select: { firstName: true, lastName: true } } },
    });
    if (orders.length === 0) {
      await this.sendOrEdit(chatId, 'Aktiv buyurtmalar yoʻq.', { reply_markup: await this.getMenuWithPanel(chatId) }, messageId);
      return;
    }
    const lines = orders.map(
      (o) =>
        `📋 ${o.orderNumber} — ${getOrderStatusLabel(o.status, o.deliveryType)} — ${Number(o.totalAmount).toLocaleString('uz-UZ')} soʻm`,
    );
    const orderButtons: TelegramBotModule.InlineKeyboardButton[][] = [];
    for (let i = 0; i < orders.length; i += 2) {
      const row: TelegramBotModule.InlineKeyboardButton[] = [];
      row.push({ text: `📄 ${orders[i].orderNumber}`, callback_data: `order_detail:${orders[i].id}`, style: 'primary' });
      if (orders[i + 1]) row.push({ text: `📄 ${orders[i + 1].orderNumber}`, callback_data: `order_detail:${orders[i + 1].id}`, style: 'primary' });
      orderButtons.push(row);
    }
    const backRows = await this.getBackMenuRows(chatId);
    const reply_markup: TelegramBotModule.InlineKeyboardMarkup = { inline_keyboard: [...orderButtons, ...backRows] };
    await this.sendOrEdit(chatId, '<b>Aktiv buyurtmalar</b>\n\nBatafsil uchun tugmani bosing:\n\n' + lines.join('\n'), { parse_mode: 'HTML', reply_markup }, messageId);
  }

  private async sendStatsResponse(chatId: string, messageId?: number) {
    const adminChatId = await this.getAdminTelegramChatId();
    if (adminChatId === chatId) {
      const [usersCount, productsCount, ordersCount, totalRevenue, pendingProducts, pendingReviews] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.product.count({ where: { isActive: true } }),
        this.prisma.order.count(),
        this.prisma.order.aggregate({ _sum: { totalAmount: true }, where: { paymentStatus: 'PAID' } }),
        this.prisma.product.count({ where: { isActive: true, isModerated: false } }),
        this.prisma.review.count({ where: { isModerated: false } }),
      ]);
      const revenue = totalRevenue._sum.totalAmount?.toString() ?? '0';
      const text =
        '📊 <b>Platforma statistikasi</b>\n\n' +
        `👥 Foydalanuvchilar: ${usersCount}\n` +
        `📦 Tovarlar: ${productsCount}\n` +
        `📋 Buyurtmalar: ${ordersCount}\n` +
        `💰 Daromad (toʻlangan): ${Number(revenue).toLocaleString('uz-UZ')} soʻm\n\n` +
        `⏳ Moderatsiya kutilmoqda:\n  • Tovarlar: ${pendingProducts}\n  • Sharhlar: ${pendingReviews}`;
      await this.sendOrEdit(chatId, text, { parse_mode: 'HTML', reply_markup: await this.getMenuWithPanel(chatId) }, messageId);
      return;
    }
    const shop = await this.prisma.shop.findFirst({
      where: { telegramChatId: chatId },
      select: { userId: true },
    });
    if (!shop) {
      await this.sendOrEdit(chatId, 'Avval hisobingizni ulang: Sozlamalar da kodni kiriting.', { reply_markup: await this.getMenuWithPanel(chatId) }, messageId);
      return;
    }
    const [ordersCount, pendingCount, paidSum, productsCount] = await Promise.all([
      this.prisma.order.count({ where: { sellerId: shop.userId } }),
      this.prisma.order.count({ where: { sellerId: shop.userId, status: 'PENDING' } }),
      this.prisma.order.aggregate({ _sum: { totalAmount: true }, where: { sellerId: shop.userId, paymentStatus: 'PAID' } }),
      this.prisma.product.count({ where: { shop: { userId: shop.userId } } }),
    ]);
    const revenue = paidSum._sum.totalAmount?.toString() ?? '0';
    const text =
      '📊 <b>Doʻkoningiz statistikasi</b>\n\n' +
      `📋 Barcha buyurtmalar: ${ordersCount}\n` +
      `⏳ Kutilmoqda: ${pendingCount}\n` +
      `📦 Tovarlar: ${productsCount}\n` +
      `💰 Daromad (toʻlangan): ${Number(revenue).toLocaleString('uz-UZ')} soʻm`;
    await this.sendOrEdit(chatId, text, { parse_mode: 'HTML', reply_markup: await this.getMenuWithPanel(chatId) }, messageId);
  }

  private async sendPendingResponse(chatId: string, messageId?: number) {
    const adminChatId = await this.getAdminTelegramChatId();
    if (adminChatId === chatId) {
      const [pendingProducts, pendingReviews] = await Promise.all([
        this.prisma.product.count({ where: { isActive: true, isModerated: false } }),
        this.prisma.review.count({ where: { isModerated: false } }),
      ]);
      const reply_markup: TelegramBotModule.InlineKeyboardMarkup = { inline_keyboard: await this.getBackMenuRows(chatId) };
      await this.sendOrEdit(
        chatId,
        '⏳ <b>Moderatsiya kutilmoqda</b>\n\n📦 Tovarlar: ' + pendingProducts + '\n💬 Sharhlar: ' + pendingReviews + (this.telegram.getBaseUrl() ? '\n\nTugmalar orqali veb panelda oching.' : ''),
        { parse_mode: 'HTML', reply_markup },
        messageId,
      );
      return;
    }
    const shop = await this.prisma.shop.findFirst({
      where: { telegramChatId: chatId },
      select: { userId: true },
    });
    if (!shop) {
      await this.sendOrEdit(chatId, 'Avval doʻkoningizni ulang: Sozlamalar → Telegram da kodni kiriting.', { reply_markup: await this.getMenuWithPanel(chatId) }, messageId);
      return;
    }
    const pendingCount = await this.prisma.order.count({
      where: { sellerId: shop.userId, status: 'PENDING' },
    });
    await this.sendOrEdit(
      chatId,
      pendingCount > 0 ? `⏳ Kutilmoqda buyurtmalar: <b>${pendingCount}</b> ta` : '⏳ Kutilmoqda buyurtmalar yoʻq.',
      { parse_mode: 'HTML', reply_markup: await this.getMenuWithPanel(chatId) },
      messageId,
    );
  }

  private async sendTodayResponse(chatId: string, messageId?: number) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const adminChatId = await this.getAdminTelegramChatId();
    if (adminChatId === chatId) {
      const [count, sum] = await Promise.all([
        this.prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
        this.prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: { createdAt: { gte: todayStart }, paymentStatus: 'PAID' },
        }),
      ]);
      const total = sum._sum.totalAmount?.toString() ?? '0';
      await this.sendOrEdit(
        chatId,
        '📅 <b>Bugun (platforma)</b>\n\n📋 Buyurtmalar: ' +
          count +
          '\n💰 Toʻlangan summa: ' +
          Number(total).toLocaleString('uz-UZ') +
          ' soʻm',
        { parse_mode: 'HTML', reply_markup: await this.getMenuWithPanel(chatId) },
        messageId,
      );
      return;
    }
    const shop = await this.prisma.shop.findFirst({
      where: { telegramChatId: chatId },
      select: { userId: true },
    });
    if (!shop) {
      await this.sendOrEdit(chatId, 'Avval doʻkoningizni ulang: Sozlamalar → Telegram da kodni kiriting.', { reply_markup: await this.getMenuWithPanel(chatId) }, messageId);
      return;
    }
    const [count, sum] = await Promise.all([
      this.prisma.order.count({ where: { sellerId: shop.userId, createdAt: { gte: todayStart } } }),
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { sellerId: shop.userId, createdAt: { gte: todayStart }, paymentStatus: 'PAID' },
      }),
    ]);
    const total = sum._sum.totalAmount?.toString() ?? '0';
    await this.sendOrEdit(
      chatId,
      '📅 <b>Bugun (doʻkoningiz)</b>\n\n📋 Buyurtmalar: ' +
        count +
        '\n💰 Toʻlangan summa: ' +
        Number(total).toLocaleString('uz-UZ') +
        ' soʻm',
      { parse_mode: 'HTML', reply_markup: await this.getMenuWithPanel(chatId) },
      messageId,
    );
  }

  private async sendBuyerOrdersResponse(chatId: string, messageId?: number) {
    const buyer = await this.getBuyerByTelegramChatId(chatId);
    if (!buyer) {
      const menuMarkup = await this.getMenuWithPanel(chatId);
      await this.sendOrEdit(
        chatId,
        "Mening buyurtmalarim ko'rish uchun avval do'konni oching (quyidagi tugma) va bir marta kiriting — keyin buyurtmalar shu yerdan ko'rinadi.",
        { parse_mode: 'HTML', reply_markup: menuMarkup },
        messageId,
      );
      return;
    }
    const orders = await this.prisma.order.findMany({
      where: { buyerId: buyer.id },
      take: 15,
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { product: { select: { title: true } } } },
        seller: { select: { shop: { select: { name: true } } } },
      },
    });
    const baseUrl = this.telegram.getBaseUrl();
    const webAppUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/telegram-app` : null;
    const menuRows = getBuyerMenuRows(webAppUrl);
    if (orders.length === 0) {
      await this.sendOrEdit(
        chatId,
        '📋 <b>Mening buyurtmalarim</b>\n\nHali buyurtmalar yoʻq. Doʻkonda xarid qilish uchun quyidagi tugmani bosing.',
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: menuRows } },
        messageId,
      );
      return;
    }
    const lines = orders.map(
      (o) =>
        `• ${o.orderNumber} — ${getOrderStatusLabel(o.status, o.deliveryType)} — ${Number(o.totalAmount).toLocaleString('uz-UZ')} soʻm`,
    );
    const orderButtons: TelegramBotModule.InlineKeyboardButton[][] = [];
    for (let i = 0; i < Math.min(orders.length, 10); i += 2) {
      const row: TelegramBotModule.InlineKeyboardButton[] = [];
      row.push({ text: `📄 ${orders[i].orderNumber}`, callback_data: `buyer_order_detail:${orders[i].id}`, style: 'primary' });
      if (orders[i + 1]) row.push({ text: `📄 ${orders[i + 1].orderNumber}`, callback_data: `buyer_order_detail:${orders[i + 1].id}`, style: 'primary' });
      orderButtons.push(row);
    }
    const reply_markup: TelegramBotModule.InlineKeyboardMarkup = { inline_keyboard: [...orderButtons, ...menuRows] };
    await this.sendOrEdit(
      chatId,
      '📋 <b>Mening buyurtmalarim</b>\n\nBatafsil uchun tugmani bosing:\n\n' + lines.join('\n'),
      { parse_mode: 'HTML', reply_markup },
      messageId,
    );
  }

  private async sendHelpResponse(
    chatId: string,
    messageId?: number,
    buyer?: { id: string } | null,
    shop?: { id: string } | null,
    isAdmin?: boolean,
  ) {
    const menuMarkup = await this.getMenuWithPanel(chatId);
    let isSellerOrAdmin = !!shop || !!isAdmin;
    if (isSellerOrAdmin === false && buyer === undefined) {
      const adminChatId = await this.getAdminTelegramChatId();
      const shopFound = await this.prisma.shop.findFirst({ where: { telegramChatId: chatId }, select: { id: true } });
      isSellerOrAdmin = adminChatId === chatId || !!shopFound;
    }
    const text = isSellerOrAdmin
      ? '<b>Oline Bozor bot</b>\n\n' +
        'Sotuvchilar va admin uchun. Avval Sozlamalarda kodni kiriting.\n\n' +
        '<b>Buyruqlar:</b>\n' +
        '• /code — Ulash kodi olish (Admin yoki Sotuvchi sozlamalarida kiriting)\n' +
        '• /start, /link — Bosh menyu / ulash kodi (agar allaqachon ulangan boʻlsa)\n' +
        '• /orders — Aktiv buyurtmalar\n' +
        '• /stats — Statistika\n' +
        '• /pending — Kutilmoqda\n' +
        '• /today — Bugungi buyurtmalar\n' +
        '• /help — Yordam\n\n' +
        'Buyurtma xabarida tugmalar orqali holatni oʻzgartiring.'
      : '<b>Oline Bozor — xaridorlar uchun</b>\n\n' +
        '• <b>/start</b> — Bosh menyu\n' +
        '• <b>/shop</b> — Do\'konni ochish (veb-ilova)\n' +
        '• <b>/orders</b> — Mening buyurtmalarim\n' +
        '• <b>/help</b> — Yordam\n\n' +
        "Do'kon tugmasi orqali katalog, savatcha va buyurtma berish. Birinchi ochishda avtomatik ro'yxatdan o'tasiz.";
    await this.sendOrEdit(chatId, text, { parse_mode: 'HTML', reply_markup: menuMarkup }, messageId);
  }

  private async handleCallback(query: TelegramBotModule.CallbackQuery) {
    const data = query.data;
    const chatId = query.message?.chat?.id;
    const messageId = query.message?.message_id;
    if (!data || !chatId || !this.bot) return;

    if (data.startsWith('cmd:')) {
      const cmd = data.slice(4);
      await this.bot.answerCallbackQuery(query.id);
      const msgId = query.message?.message_id;
      if (cmd === 'menu') return this.sendMenuResponse(String(chatId), msgId);
      if (cmd === 'orders') {
        const buyer = await this.getBuyerByTelegramChatId(String(chatId));
        const shop = await this.prisma.shop.findFirst({ where: { telegramChatId: String(chatId) }, select: { id: true } });
        const adminChatId = await this.getAdminTelegramChatId();
        if (buyer && !shop && adminChatId !== String(chatId)) return this.sendBuyerOrdersResponse(String(chatId), msgId);
        return this.sendOrdersResponse(String(chatId), msgId);
      }
      if (cmd === 'stats') return this.sendStatsResponse(String(chatId), msgId);
      if (cmd === 'pending') return this.sendPendingResponse(String(chatId), msgId);
      if (cmd === 'today') return this.sendTodayResponse(String(chatId), msgId);
      if (cmd === 'help') {
        const buyer = await this.getBuyerByTelegramChatId(String(chatId));
        const shop = await this.prisma.shop.findFirst({ where: { telegramChatId: String(chatId) }, select: { id: true } });
        const adminChatId = await this.getAdminTelegramChatId();
        return this.sendHelpResponse(String(chatId), msgId, buyer, shop, adminChatId === String(chatId));
      }
      return;
    }

    if (data === 'buyer_orders') {
      await this.bot.answerCallbackQuery(query.id);
      return this.sendBuyerOrdersResponse(String(chatId), query.message?.message_id);
    }

    if (data.startsWith('buyer_order_detail:')) {
      const orderId = data.slice(19);
      const buyer = await this.getBuyerByTelegramChatId(String(chatId));
      if (!buyer) {
        await this.bot.answerCallbackQuery(query.id, { text: 'Avval do\'konni oching va kiriting.' });
        return;
      }
      await this.bot.answerCallbackQuery(query.id, { text: 'Yuklanmoqda…' });
      const orderInclude = {
        items: { include: { product: { select: { title: true } }, variant: true } },
        seller: { select: { firstName: true, lastName: true, shop: { select: { name: true } } } },
      } as const;
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, buyerId: buyer.id },
        include: orderInclude,
      });
      if (!order) {
        await this.bot.answerCallbackQuery(query.id, { text: 'Buyurtma topilmadi.' });
        return;
      }
      type BuyerOrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
      const o = order as BuyerOrderWithRelations;
      const sellerName = o.seller
        ? `${o.seller.firstName} ${o.seller.lastName}${o.seller.shop ? ` (${o.seller.shop.name})` : ''}`
        : '—';
      const addr =
        o.shippingAddress && typeof o.shippingAddress === 'object'
          ? Object.entries(o.shippingAddress as Record<string, unknown>)
              .filter(([, v]) => v != null && String(v).trim() !== '')
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ') || '—'
          : '—';
      const itemsLines = o.items
        .map(
          (i: { product: { title: string }; variant?: { options?: unknown } | null; quantity: number; price: { toNumber?: () => number } | number }) =>
            `  • ${esc(i.product.title)}${i.variant?.options ? ` (${esc(formatVariantOptions(i.variant.options))})` : ''} × ${i.quantity} = ${Number(i.price).toLocaleString('uz-UZ')} soʻm`,
        )
        .join('\n');
      const text =
        '📄 <b>Buyurtma batafsil</b>\n\n' +
        `📋 Raqam: <code>${esc(o.orderNumber)}</code>\n` +
        `📌 Holat: ${getOrderStatusLabel(o.status, o.deliveryType)}\n` +
        `💳 To'lov: ${PAYMENT_STATUS_LABELS[o.paymentStatus ?? ''] ?? o.paymentStatus ?? '—'} (${PAYMENT_METHOD_LABELS[o.paymentMethod ?? ''] ?? o.paymentMethod ?? '—'})\n` +
        `🚚 Yetkazish: ${DELIVERY_TYPE_LABELS[o.deliveryType ?? ''] ?? o.deliveryType ?? '—'}\n` +
        `💰 Jami: ${Number(o.totalAmount).toLocaleString('uz-UZ')} soʻm\n` +
        `📅 Sana: ${new Date(o.createdAt).toLocaleString('uz-UZ')}\n\n` +
        `🏪 Sotuvchi: ${esc(sellerName)}\n📍 Manzil: ${esc(addr)}\n` +
        (o.notes ? `📝 Izoh: ${esc(o.notes)}\n` : '') +
        '\n<b>Mahsulotlar:</b>\n' +
        itemsLines.split('\n').map((l: string) => esc(l)).join('\n');
      const baseUrl = this.telegram.getBaseUrl();
      const webAppUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/telegram-app` : null;
      const reply_markup: TelegramBotModule.InlineKeyboardMarkup = { inline_keyboard: [...getBuyerMenuRows(webAppUrl)] };
      await this.sendOrEdit(String(chatId), text, { parse_mode: 'HTML', reply_markup }, messageId);
      return;
    }

    if (data.startsWith('admin_order_detail:')) {
      const orderId = data.slice(19);
      const adminChatId = await this.getAdminTelegramChatId();
      if (adminChatId !== String(chatId)) {
        await this.bot.answerCallbackQuery(query.id, { text: 'Ruxsat yoʻq.' });
        return;
      }
      await this.bot.answerCallbackQuery(query.id, { text: 'Yuklanmoqda…' });
      const orderInclude = {
        items: { include: { product: { select: { title: true } }, variant: true } },
        buyer: { select: { firstName: true, lastName: true, email: true, phone: true } },
        seller: { select: { firstName: true, lastName: true, shop: { select: { name: true } } } },
      } as const;
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: orderInclude,
      });
      if (!order) {
        await this.bot.answerCallbackQuery(query.id, { text: 'Buyurtma topilmadi.' });
        return;
      }
      type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
      const o = order as OrderWithRelations;
      const buyerName = o.buyer ? `${o.buyer.firstName} ${o.buyer.lastName}` : o.guestPhone || o.guestEmail || 'Mehmon';
      const buyerContact = o.buyer
        ? [o.buyer.email, o.buyer.phone].filter(Boolean).join(', ') || '—'
        : [o.guestEmail, o.guestPhone].filter(Boolean).join(', ') || '—';
      const sellerName = o.seller
        ? `${o.seller.firstName} ${o.seller.lastName}${o.seller.shop ? ` (${o.seller.shop.name})` : ''}`
        : '—';
      const addr =
        o.shippingAddress && typeof o.shippingAddress === 'object'
          ? Object.entries(o.shippingAddress as Record<string, unknown>)
              .filter(([, v]) => v != null && String(v).trim() !== '')
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ') || '—'
          : '—';
      const itemsLines = o.items
        .map(
          (i: { product: { title: string }; variant?: { options?: unknown } | null; quantity: number; price: { toNumber?: () => number } | number }) =>
            `  • ${i.product.title}${i.variant?.options ? ` (${formatVariantOptions(i.variant.options)})` : ''} × ${i.quantity} = ${Number(i.price).toLocaleString('uz-UZ')} soʻm`,
        )
        .join('\n');
      const text =
        '📄 <b>ADMIN: Buyurtma batafsil</b>\n\n' +
        `📋 Raqam: <code>${esc(o.orderNumber)}</code>\n` +
        `📌 Holat: ${getOrderStatusLabel(o.status, o.deliveryType)}\n` +
        `💳 To'lov: ${PAYMENT_STATUS_LABELS[o.paymentStatus ?? ''] ?? o.paymentStatus ?? '—'} (${PAYMENT_METHOD_LABELS[o.paymentMethod ?? ''] ?? o.paymentMethod ?? '—'})\n` +
        `🚚 Yetkazish: ${DELIVERY_TYPE_LABELS[o.deliveryType ?? ''] ?? o.deliveryType ?? '—'}\n` +
        `💰 Jami: ${Number(o.totalAmount).toLocaleString('uz-UZ')} soʻm\n` +
        `📅 Sana: ${new Date(o.createdAt).toLocaleString('uz-UZ')}\n\n` +
        `👤 Xaridor: ${esc(buyerName)}\n📞 Aloqa: ${esc(buyerContact)}\n🏪 Sotuvchi: ${esc(sellerName)}\n📍 Manzil: ${esc(addr)}\n` +
        (o.notes ? `📝 Izoh: ${esc(o.notes)}\n` : '') +
        '\n<b>Mahsulotlar:</b>\n' +
        itemsLines.split('\n').map((l: string) => esc(l)).join('\n');
      await this.sendOrEdit(String(chatId), text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: await this.getBackMenuRows(String(chatId)) } }, messageId);
      return;
    }

    if (data.startsWith('order_detail:')) {
      const orderId = data.slice(13);
      const shop = await this.prisma.shop.findFirst({
        where: { telegramChatId: String(chatId) },
        select: { userId: true },
      });
      if (!shop) {
        await this.bot.answerCallbackQuery(query.id, { text: 'Doʻkon ulanmagan.' });
        return;
      }
      await this.bot.answerCallbackQuery(query.id, { text: 'Yuklanmoqda…' });
      const sellerOrderInclude = {
        items: { include: { product: { select: { title: true } }, variant: true } },
        buyer: { select: { firstName: true, lastName: true } },
      } as const;
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, sellerId: shop.userId },
        include: sellerOrderInclude,
      });
      if (!order) {
        await this.bot.answerCallbackQuery(query.id, { text: 'Buyurtma topilmadi.' });
        return;
      }
      type SellerOrderWithRelations = Prisma.OrderGetPayload<{ include: typeof sellerOrderInclude }>;
      const so = order as SellerOrderWithRelations;
      const buyerName = so.buyer ? `${so.buyer.firstName} ${so.buyer.lastName}` : so.guestPhone || so.guestEmail || 'Mehmon';
      const itemsText = so.items
        .map(
          (i: { product: { title: string }; variant?: { options?: unknown } | null; quantity: number; price: { toNumber?: () => number } | number }) =>
            `  • ${esc(i.product.title)}${i.variant?.options ? ` (${esc(formatVariantOptions(i.variant.options))})` : ''} × ${i.quantity} = ${Number(i.price).toLocaleString('uz-UZ')} soʻm`,
        )
        .join('\n');
      const text =
        '📄 <b>Buyurtma batafsil</b>\n\n' +
        `📋 Raqam: <code>${esc(so.orderNumber)}</code>\n` +
        `📌 Holat: ${getOrderStatusLabel(so.status, so.deliveryType)}\n` +
        `💳 To'lov: ${PAYMENT_STATUS_LABELS[so.paymentStatus ?? ''] ?? so.paymentStatus ?? '—'} (${PAYMENT_METHOD_LABELS[so.paymentMethod ?? ''] ?? so.paymentMethod ?? '—'})\n` +
        `👤 Xaridor: ${esc(buyerName)}\n` +
        `💰 Jami: ${Number(so.totalAmount).toLocaleString('uz-UZ')} soʻm\n` +
        `📅 Sana: ${new Date(so.createdAt).toLocaleString('uz-UZ')}\n\n` +
        '<b>Mahsulotlar:</b>\n' +
        itemsText;
      const backRows = await this.getBackMenuRows(String(chatId));
      const canMarkPaid =
        (so.paymentMethod === 'CASH' || so.paymentMethod === 'CARD_ON_DELIVERY') && so.paymentStatus === 'PENDING';
      const reply_markup: TelegramBotModule.InlineKeyboardMarkup = {
        inline_keyboard: canMarkPaid
          ? [[{ text: "💳 To'lov qabul qilindi", callback_data: `order_mark_paid:${orderId}`, style: 'primary' }], ...backRows]
          : backRows,
      };
      await this.sendOrEdit(String(chatId), text, { parse_mode: 'HTML', reply_markup }, messageId);
      return;
    }

    if (data.startsWith('order_mark_paid:')) {
      const orderId = data.slice(16);
      const shop = await this.prisma.shop.findFirst({
        where: { telegramChatId: String(chatId) },
        select: { userId: true },
      });
      if (!shop) {
        await this.bot.answerCallbackQuery(query.id, { text: 'Doʻkon ulanmagan.' });
        return;
      }
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, sellerId: shop.userId },
        select: { paymentMethod: true, paymentStatus: true },
      });
      if (!order) {
        await this.bot.answerCallbackQuery(query.id, { text: 'Buyurtma topilmadi.' });
        return;
      }
      if (order.paymentMethod !== 'CASH' && order.paymentMethod !== 'CARD_ON_DELIVERY') {
        await this.bot.answerCallbackQuery(query.id, { text: "Faqat naqd yoki karta (yetkazishda) uchun belgilash mumkin." });
        return;
      }
      if (order.paymentStatus === 'PAID') {
        await this.bot.answerCallbackQuery(query.id, { text: "To'lov allaqachon belgilangan." });
        return;
      }
      await this.prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'PAID' },
      });
      this.prisma.orderAuditEvent
        .create({
          data: {
            orderId,
            actorUserId: shop.userId,
            action: 'SELLER_MARK_PAID',
            meta: { paymentMethod: order.paymentMethod, source: 'telegram_bot' },
          },
        })
        .catch((err) => this.logger.warn(`order audit log failed: ${(err as Error).message}`));
      await this.bot.answerCallbackQuery(query.id, { text: "To'lov belgilandi." });
      const messageId = query.message?.message_id;
      if (messageId) {
        const updated = await this.prisma.order.findFirst({
          where: { id: orderId, sellerId: shop.userId },
          include: {
            items: { include: { product: { select: { title: true } }, variant: true } },
            buyer: { select: { firstName: true, lastName: true } },
          },
        });
        if (updated) {
          const buyerName = updated.buyer ? `${updated.buyer.firstName} ${updated.buyer.lastName}` : updated.guestPhone || updated.guestEmail || 'Mehmon';
          const itemsText = updated.items
            .map(
              (i: { product: { title: string }; variant?: { options?: unknown } | null; quantity: number; price: { toNumber?: () => number } | number }) =>
                `  • ${esc(i.product.title)}${i.variant?.options ? ` (${esc(formatVariantOptions(i.variant.options))})` : ''} × ${i.quantity} = ${Number(i.price).toLocaleString('uz-UZ')} soʻm`,
            )
            .join('\n');
          const text =
            '📄 <b>Buyurtma batafsil</b>\n\n' +
            `📋 Raqam: <code>${esc(updated.orderNumber)}</code>\n` +
            `📌 Holat: ${getOrderStatusLabel(updated.status, updated.deliveryType)}\n` +
            `💳 To'lov: ${PAYMENT_STATUS_LABELS[updated.paymentStatus ?? ''] ?? updated.paymentStatus ?? '—'} (${PAYMENT_METHOD_LABELS[updated.paymentMethod ?? ''] ?? updated.paymentMethod ?? '—'})\n` +
            `👤 Xaridor: ${esc(buyerName)}\n` +
            `💰 Jami: ${Number(updated.totalAmount).toLocaleString('uz-UZ')} soʻm\n` +
            `📅 Sana: ${new Date(updated.createdAt).toLocaleString('uz-UZ')}\n\n` +
            '<b>Mahsulotlar:</b>\n' + itemsText;
          const reply_markup: TelegramBotModule.InlineKeyboardMarkup = { inline_keyboard: await this.getBackMenuRows(String(chatId)) };
          await this.sendOrEdit(String(chatId), text, { parse_mode: 'HTML', reply_markup }, messageId);
        }
      }
      return;
    }

    if (data.startsWith('seller_app:approve:') || data.startsWith('seller_app:reject:')) {
      const adminChatId = await this.getAdminTelegramChatId();
      if (adminChatId !== String(chatId)) {
        await this.bot.answerCallbackQuery(query.id, { text: 'Ruxsat yoʻq.' });
        return;
      }
      const applicationId = data.startsWith('seller_app:approve:')
        ? data.slice('seller_app:approve:'.length)
        : data.slice('seller_app:reject:'.length);
      const adminUser = await this.prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
      if (!adminUser) {
        await this.bot.answerCallbackQuery(query.id, { text: 'Admin topilmadi.' });
        return;
      }
      const app = await this.prisma.sellerApplication.findUnique({
        where: { id: applicationId },
        include: { user: true },
      });
      if (!app) {
        await this.bot.answerCallbackQuery(query.id, { text: 'Ariza topilmadi.' });
        return;
      }
      if (app.status !== 'PENDING') {
        await this.bot.answerCallbackQuery(query.id, { text: 'Ariza allaqachon koʻrib chiqilgan.' });
        return;
      }
      if (data.startsWith('seller_app:approve:')) {
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
        await this.prisma.$transaction(async (tx) => {
          await tx.shop.create({
            data: {
              userId: app.userId,
              name: app.shopName,
              slug,
              description: app.description ?? null,
            },
          });
          await tx.user.update({
            where: { id: app.userId },
            data: { role: 'SELLER' },
          });
          await tx.sellerApplication.update({
            where: { id: applicationId },
            data: { status: 'APPROVED', reviewedAt: new Date(), reviewedById: adminUser.id },
          });
        });
        await this.bot.answerCallbackQuery(query.id, { text: '✅ Ariza tasdiqlandi.' });
        const newText = (query.message as TelegramBotModule.Message)?.text + '\n\n✅ <b>Tasdiqlandi</b>';
        await this.bot.editMessageText(newText, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML',
        }).catch(() => {});
        await this.bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: messageId },
        ).catch(() => {});
      } else {
        await this.prisma.sellerApplication.update({
          where: { id: applicationId },
          data: { status: 'REJECTED', rejectReason: null, reviewedAt: new Date(), reviewedById: adminUser.id },
        });
        await this.bot.answerCallbackQuery(query.id, { text: '❌ Ariza rad etildi.' });
        const newText = (query.message as TelegramBotModule.Message)?.text + '\n\n❌ <b>Rad etildi</b>';
        await this.bot.editMessageText(newText, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML',
        }).catch(() => {});
        await this.bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: messageId },
        ).catch(() => {});
      }
      return;
    }

    if (!data.startsWith('order:') || !messageId) return;
    const parts = data.split(':');
    if (parts.length !== 3) return;
    const [, orderId, newStatus] = parts as [string, string, string];
    const status = newStatus as OrderStatus;

    const shop = await this.prisma.shop.findFirst({
      where: { telegramChatId: String(chatId) },
      select: { userId: true },
    });
    if (!shop) {
      await this.bot.answerCallbackQuery(query.id, { text: 'Doʻkon ulanmagan.' });
      return;
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, sellerId: shop.userId },
    });
    if (!order) {
      await this.bot.answerCallbackQuery(query.id, { text: 'Buyurtma topilmadi.' });
      return;
    }

    const allowed: OrderStatus[] = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (!allowed.includes(status)) {
      await this.bot.answerCallbackQuery(query.id, { text: 'Bunday holat mavjud emas.' });
      return;
    }

    const isPrepaid = order.paymentMethod === 'CLICK' || order.paymentMethod === 'PAYME';
    if ((status === 'SHIPPED' || status === 'DELIVERED') && isPrepaid && order.paymentStatus !== 'PAID') {
      await this.bot.answerCallbackQuery(query.id, {
        text: "Click/Payme to'lovi qilinmaguncha yetkazish belgilab bo'lmaydi.",
      });
      return;
    }

    const fromStatus = order.status;
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status },
    });
    this.prisma.orderAuditEvent
      .create({
        data: {
          orderId,
          actorUserId: shop.userId,
          action: 'SELLER_STATUS',
          meta: { fromStatus, toStatus: status, source: 'telegram_bot' },
        },
      })
      .catch((err) => this.logger.warn(`order audit log failed: ${(err as Error).message}`));

    const label = getOrderStatusLabel(status);
    await this.bot.answerCallbackQuery(query.id, { text: `Holat: ${label}` });
    const msg = query.message as TelegramBotModule.Message | undefined;
    const currentText = msg?.text ?? 'Buyurtma';
    await this.bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: chatId, message_id: messageId },
    ).catch(() => {});
    await this.bot.editMessageText(
      `${currentText}\n\n✅ Yangilandi: ${label}`,
      { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' },
    ).catch(() => {});
  }
}
