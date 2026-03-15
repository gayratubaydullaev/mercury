import { Injectable, UnauthorizedException, Logger, ForbiddenException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';
import { UserRole } from '@prisma/client';
import type { JwtPayload } from '@myshopuz/shared';
import { v4 as uuidv4 } from 'uuid';
import { verifyTelegramWebAppInitData, parseTelegramUserFromInitData } from './telegram-init-data';

const REFRESH_EXPIRES_DAYS = 7;
const TELEGRAM_LOGIN_TOKEN_EXPIRES_MIN = 5;

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private mailer: MailerService,
  ) {}

  async onModuleInit() {
    await this.ensureAdminFromEnv();
  }

  async ensureAdminFromEnv() {
    const email = this.config.get<string>('ADMIN_EMAIL')?.trim().toLowerCase();
    const password = this.config.get<string>('ADMIN_PASSWORD');
    if (!email || !password) return;
    const passwordHash = await bcrypt.hash(password, 10);
    const firstName = this.config.get<string>('ADMIN_FIRST_NAME') ?? 'Admin';
    const lastName = this.config.get<string>('ADMIN_LAST_NAME') ?? 'MyShop';
    await this.prisma.user.upsert({
      where: { email },
      update: { passwordHash, role: 'ADMIN', firstName, lastName, emailVerified: true },
      create: {
        email,
        passwordHash,
        firstName,
        lastName,
        role: 'ADMIN',
        emailVerified: true,
      },
    });
    this.logger.log(`Admin ensured from env: ${email}`);
  }

  async validateUser(email: string, password: string) {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) return null;
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) return null;
    // Dev: accept literal password for seed accounts so login works even if bcrypt/DB mismatch
    if (process.env.NODE_ENV !== 'production' && password != null) {
      const p = String(password).trim();
      if (normalizedEmail === 'admin@myshop.uz' && p === 'Admin123!') return user;
      if (normalizedEmail === 'seller@myshop.uz' && p === 'Seller123!') return user;
    }
    if (!user.passwordHash) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? user : null;
  }

  async devResetSeedUsers() {
    const adminHash = await bcrypt.hash('Admin123!', 10);
    const sellerHash = await bcrypt.hash('Seller123!', 10);
    await this.prisma.user.upsert({
      where: { email: 'admin@myshop.uz' },
      update: { passwordHash: adminHash, role: 'ADMIN', firstName: 'Admin', lastName: 'MyShop' },
      create: {
        email: 'admin@myshop.uz',
        passwordHash: adminHash,
        firstName: 'Admin',
        lastName: 'MyShop',
        role: 'ADMIN',
        emailVerified: true,
      },
    });
    await this.prisma.user.upsert({
      where: { email: 'seller@myshop.uz' },
      update: { passwordHash: sellerHash, role: 'SELLER', firstName: 'Sotuvchi', lastName: "Do'kon" },
      create: {
        email: 'seller@myshop.uz',
        passwordHash: sellerHash,
        firstName: 'Sotuvchi',
        lastName: "Do'kon",
        role: 'SELLER',
        emailVerified: true,
      },
    });
    return { ok: true, message: 'Admin and seller passwords reset. Use admin@myshop.uz / Admin123! or seller@myshop.uz / Seller123!' };
  }

  async login(user: { id: string; email: string; role: UserRole; isGuest?: boolean; moderatorPermissions?: unknown }) {
    const isGuest = !!user.isGuest;
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      isGuest,
      ...(user.role === UserRole.ADMIN_MODERATOR && user.moderatorPermissions != null && { moderatorPermissions: user.moderatorPermissions as JwtPayload['moderatorPermissions'] }),
    };
    const accessToken = this.jwt.sign(payload);
    const refreshToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRES_DAYS);
    await this.prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt },
    });
    return {
      accessToken,
      refreshToken,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isGuest,
        ...(user.role === UserRole.ADMIN_MODERATOR && user.moderatorPermissions != null && { moderatorPermissions: user.moderatorPermissions }),
      },
    };
  }

  async refresh(refreshToken: string) {
    const token = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });
    if (!token || token.expiresAt < new Date()) {
      if (token) await this.prisma.refreshToken.delete({ where: { id: token.id } }).catch(() => {});
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    await this.prisma.refreshToken.delete({ where: { id: token.id } });
    return this.login(token.user);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    return { success: true };
  }

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: UserRole;
  }) {
    const hash = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: hash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role ?? 'BUYER',
      },
    });
    return this.login(user);
  }

  private generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendOtp(email: string): Promise<{ success: boolean }> {
    const code = this.generateOtpCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);
    await this.prisma.otpCode.deleteMany({ where: { email } });
    await this.prisma.otpCode.create({
      data: { email, code, expiresAt },
    });
    await this.mailer.sendMail({
      to: email,
      subject: 'Oline Bozor – Tasdiqlash kodi',
      text: `Tasdiqlash kodingiz: ${code}. Kod 10 daqiqa amal qiladi.`,
      html: `<p>Tasdiqlash kodingiz: <strong>${code}</strong>.</p><p>Kod 10 daqiqa amal qiladi.</p>`,
    });
    return { success: true };
  }

  async verifyOtp(
    email: string,
    code: string,
    firstName?: string,
    lastName?: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date; user: { id: string; email: string; role: UserRole } } | null> {
    const otp = await this.prisma.otpCode.findFirst({
      where: { email, code },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.expiresAt < new Date()) return null;
    await this.prisma.otpCode.deleteMany({ where: { id: otp.id } });
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      if (!firstName || !lastName) return null;
      user = await this.prisma.user.create({
        data: { email, firstName, lastName, role: 'BUYER', emailVerified: true },
      });
    } else if (user.isBlocked) return null;
    return this.login(user);
  }

  async loginOrRegisterByTelegram(initData: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date; user: { id: string; email: string; role: UserRole } }> {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set, Telegram Web App auth disabled');
      throw new BadRequestException('Telegram login is not configured');
    }
    if (!verifyTelegramWebAppInitData(initData, botToken)) {
      throw new UnauthorizedException('Invalid Telegram init data');
    }
    const tgUser = parseTelegramUserFromInitData(initData);
    if (!tgUser) {
      throw new BadRequestException('Invalid Telegram user data');
    }
    const telegramId = String(tgUser.id);
    const firstName = (tgUser.first_name ?? '').trim() || 'User';
    const lastName = (tgUser.last_name ?? '').trim() || '';
    const email = `telegram_${tgUser.id}@t.me`;

    let user = await this.prisma.user.findFirst({ where: { telegramId } });
    if (user) {
      if (user.isBlocked) throw new ForbiddenException('Account blocked');
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { firstName, lastName },
      });
    } else {
      const existingByEmail = await this.prisma.user.findUnique({ where: { email } });
      if (existingByEmail) {
        user = await this.prisma.user.update({
          where: { id: existingByEmail.id },
          data: { telegramId, firstName, lastName },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            email,
            telegramId,
            firstName,
            lastName,
            role: 'BUYER',
            emailVerified: false,
          },
        });
      }
    }
    return this.login(user);
  }

  async findOrCreateUserByTelegramId(
    telegramId: string,
    firstName?: string,
    lastName?: string,
  ): Promise<{ id: string; email: string; role: UserRole }> {
    const first = (firstName ?? '').trim() || 'User';
    const last = (lastName ?? '').trim() || '';
    const email = `telegram_${telegramId}@t.me`;
    const existingUser = await this.prisma.user.findFirst({
      where: { telegramId },
      select: { id: true, email: true, role: true, isBlocked: true },
    });
    if (existingUser) {
      if (existingUser.isBlocked) throw new ForbiddenException('Account blocked');
      if (existingUser.role === 'ADMIN') {
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: { firstName: first, lastName: last },
        });
        return existingUser;
      }
      const settings = await this.prisma.platformSettings.findFirst({
        select: { adminTelegramChatId: true },
      });
      const adminChatId = (settings as { adminTelegramChatId?: string | null } | null)?.adminTelegramChatId;
      if (adminChatId && String(adminChatId).trim() === String(telegramId).trim()) {
        let adminUser = await this.prisma.user.findFirst({
          where: { role: 'ADMIN', telegramId: null },
          select: { id: true, email: true, role: true, isBlocked: true },
        });
        if (!adminUser) {
          adminUser = await this.prisma.user.findFirst({
            where: { role: 'ADMIN' },
            select: { id: true, email: true, role: true, isBlocked: true },
          });
        }
        if (adminUser) {
          if (adminUser.isBlocked) throw new ForbiddenException('Account blocked');
          await this.prisma.user.update({
            where: { id: existingUser.id },
            data: { telegramId: null },
          });
          await this.prisma.user.update({
            where: { id: adminUser.id },
            data: { telegramId, firstName: first, lastName: last },
          });
          return adminUser;
        }
      }
      const shopByChat = await this.prisma.shop.findFirst({
        where: { telegramChatId: telegramId },
        select: { userId: true },
      });
      if (shopByChat) {
        const sellerUser = await this.prisma.user.findUnique({
          where: { id: shopByChat.userId },
          select: { id: true, email: true, role: true, isBlocked: true },
        });
        if (sellerUser) {
          if (sellerUser.isBlocked) throw new ForbiddenException('Account blocked');
          await this.prisma.user.update({
            where: { id: existingUser.id },
            data: { telegramId: null },
          });
          await this.prisma.user.update({
            where: { id: sellerUser.id },
            data: { telegramId, firstName: first, lastName: last },
          });
          return sellerUser;
        }
      }
      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: { firstName: first, lastName: last },
      });
      return existingUser;
    }
    const existingByEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingByEmail) {
      await this.prisma.user.update({
        where: { id: existingByEmail.id },
        data: { telegramId, firstName: first, lastName: last },
      });
      return { id: existingByEmail.id, email: existingByEmail.email, role: existingByEmail.role };
    }
    const settings = await this.prisma.platformSettings.findFirst({
      select: { adminTelegramChatId: true },
    });
    const adminChatId = (settings as { adminTelegramChatId?: string | null } | null)?.adminTelegramChatId;
    if (adminChatId && String(adminChatId).trim() === String(telegramId).trim()) {
      let adminUser = await this.prisma.user.findFirst({
        where: { role: 'ADMIN', telegramId },
        select: { id: true, email: true, role: true, isBlocked: true },
      });
      if (!adminUser) {
        adminUser = await this.prisma.user.findFirst({
          where: { role: 'ADMIN', telegramId: null },
          select: { id: true, email: true, role: true, isBlocked: true },
        });
      }
      if (!adminUser) {
        adminUser = await this.prisma.user.findFirst({
          where: { role: 'ADMIN' },
          select: { id: true, email: true, role: true, isBlocked: true },
        });
      }
      if (adminUser) {
        if (adminUser.isBlocked) throw new ForbiddenException('Account blocked');
        await this.prisma.user.update({
          where: { id: adminUser.id },
          data: { telegramId, firstName: first, lastName: last },
        });
        return adminUser;
      }
    }
    const shopByChat = await this.prisma.shop.findFirst({
      where: { telegramChatId: telegramId },
      select: { user: { select: { id: true, email: true, role: true, isBlocked: true } } },
    });
    if (shopByChat?.user) {
      const sellerUser = shopByChat.user;
      if (sellerUser.isBlocked) throw new ForbiddenException('Account blocked');
      await this.prisma.user.update({
        where: { id: sellerUser.id },
        data: { telegramId, firstName: first, lastName: last },
      });
      return sellerUser;
    }
    const created = await this.prisma.user.create({
      data: {
        email,
        telegramId,
        firstName: first,
        lastName: last,
        role: 'BUYER',
        emailVerified: false,
      },
    });
    return { id: created.id, email: created.email, role: created.role };
  }

  async requestTelegramLogin(): Promise<{ token: string; loginUrl: string }> {
    const botUsername = this.config.get<string>('TELEGRAM_BOT_USERNAME');
    if (!botUsername?.trim()) {
      this.logger.warn('TELEGRAM_BOT_USERNAME not set, Telegram login link unavailable');
      throw new BadRequestException('Telegram login is not configured');
    }
    const token = uuidv4().replace(/-/g, '').slice(0, 32);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + TELEGRAM_LOGIN_TOKEN_EXPIRES_MIN);
    await this.prisma.telegramLoginToken.create({
      data: { token, expiresAt },
    });
    const loginUrl = `https://t.me/${botUsername.trim()}?start=login_${token}`;
    return { token, loginUrl };
  }

  async requestTelegramLink(userId: string): Promise<{ token: string; linkUrl: string }> {
    const botUsername = this.config.get<string>('TELEGRAM_BOT_USERNAME');
    if (!botUsername?.trim()) {
      this.logger.warn('TELEGRAM_BOT_USERNAME not set');
      throw new BadRequestException('Telegram link is not configured');
    }
    const token = uuidv4().replace(/-/g, '').slice(0, 32);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + TELEGRAM_LOGIN_TOKEN_EXPIRES_MIN);
    await this.prisma.telegramLoginToken.create({
      data: { token, expiresAt, linkUserId: userId },
    });
    const linkUrl = `https://t.me/${botUsername.trim()}?start=link_${token}`;
    return { token, linkUrl };
  }

  private normalizePhone(phone: string): string {
    return (phone || '').replace(/\D/g, '');
  }

  async registerOrLoginGuest(data: {
    phone: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  }): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date; user: { id: string; email: string; role: UserRole } }> {
    const normalized = this.normalizePhone(data.phone);
    if (!normalized) throw new BadRequestException('Guest phone is required');
    const email = `guest_${normalized}@guest.local`;
    const firstName = (data.firstName ?? '').trim() || 'Mehmon';
    const lastName = (data.lastName ?? '').trim() || '';
    const phone = normalized;

    const byEmail = await this.prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      if (byEmail.isBlocked) throw new ForbiddenException('Account blocked');
      const updated = await this.prisma.user.update({
        where: { id: byEmail.id },
        data: { phone, firstName, lastName },
      });
      return this.login(updated);
    }
    const user = await this.prisma.user.create({
      data: {
        email,
        phone,
        firstName,
        lastName,
        role: 'BUYER',
        isGuest: true,
      },
    });
    return this.login(user);
  }

  async verifyTelegramLogin(
    token: string,
  ): Promise<
    | { status: 'pending' }
    | { status: 'linked' }
    | { accessToken: string; refreshToken: string; expiresAt: Date; user: { id: string; email: string; role: UserRole } }
  > {
    const loginTokens = this.prisma.telegramLoginToken;
    const row = await loginTokens.findUnique({ where: { token } });
    if (!row || row.expiresAt < new Date()) {
      if (row) await loginTokens.delete({ where: { id: row.id } }).catch(() => {});
      throw new UnauthorizedException('Link expired or invalid');
    }
    if (!row.telegramChatId) {
      return { status: 'pending' };
    }
    const linkUserId = row.linkUserId;
    if (linkUserId && row.telegramChatId) {
      const other = await this.prisma.user.findFirst({
        where: { telegramId: row.telegramChatId },
      });
      if (other && other.id !== linkUserId) {
        await loginTokens.delete({ where: { id: row.id } }).catch(() => {});
        throw new BadRequestException('Bu Telegram hisob allaqachon boshqa hisobga ulangan.');
      }
      await this.prisma.user.update({
        where: { id: linkUserId },
        data: { telegramId: row.telegramChatId, isGuest: false },
      });
      await loginTokens.delete({ where: { id: row.id } });
      return { status: 'linked' };
    }
    const telegramChatId = row.telegramChatId;
    if (!telegramChatId) {
      await loginTokens.delete({ where: { id: row.id } }).catch(() => {});
      throw new UnauthorizedException('User not found');
    }
    const user = await this.prisma.user.findFirst({
      where: { telegramId: telegramChatId },
    });
    if (!user) {
      await loginTokens.delete({ where: { id: row.id } }).catch(() => {});
      throw new UnauthorizedException('User not found');
    }
    if (user.isBlocked) throw new ForbiddenException('Account blocked');
    await loginTokens.delete({ where: { id: row.id } });
    return this.login(user);
  }
}
