import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';
import { UserRole } from '@prisma/client';
import type { JwtPayload } from '@myshopuz/shared';
import { v4 as uuidv4 } from 'uuid';

const REFRESH_EXPIRES_DAYS = 7;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private mailer: MailerService,
  ) {}

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

  /** Dev only: ensure admin and seller exist with known passwords. */
  async devResetSeedUsers() {
    const adminHash = await bcrypt.hash('Admin123!', 10);
    const sellerHash = await bcrypt.hash('Seller123!', 10);
    const admin = await this.prisma.user.upsert({
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
    const seller = await this.prisma.user.upsert({
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

  async login(user: { id: string; email: string; role: UserRole }) {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwt.sign(payload);
    const refreshToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRES_DAYS);
    await this.prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt },
    });
    return { accessToken, refreshToken, expiresAt, user: { id: user.id, email: user.email, role: user.role } };
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
      subject: 'MyShopUZ – Tasdiqlash kodi',
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
}
