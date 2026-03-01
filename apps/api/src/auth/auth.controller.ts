import { Body, Controller, Get, Post, Req, Res, UseGuards, UnauthorizedException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { createHmac, randomBytes } from 'crypto';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const REFRESH_COOKIE = 'refreshToken';
const COOKIE_OPTIONS = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' };
const CSRF_COOKIE = 'csrfToken';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private prisma: PrismaService
  ) {}

  @Get('csrf')
  @Public()
  @ApiOperation({ summary: 'Get CSRF token (cookie + body) for mutations' })
  getCsrf(@Res({ passthrough: true }) res: Response) {
    const token = randomBytes(32).toString('hex');
    const secret =
      process.env.CSRF_SECRET ||
      (process.env.NODE_ENV === 'production' ? undefined : 'dev-csrf-secret-not-for-production');
    if (!secret) throw new Error('CSRF_SECRET is required in production; set in .env.');
    const signed = createHmac('sha256', secret).update(token).digest('hex');
    const value = `${token}.${signed}`;
    res.cookie(CSRF_COOKIE, value, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600000,
      path: '/',
    });
    return { csrfToken: value };
  }

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Login (rate limit: 3/min)' })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.validateUser(dto.email, dto.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.isBlocked) throw new ForbiddenException('Account blocked');
    const result = await this.auth.login(user);
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS);
    return { accessToken: result.accessToken, expiresAt: result.expiresAt, user: result.user };
  }

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Register new user' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already registered');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: 'BUYER',
      },
    });
    const result = await this.auth.login(user);
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS);
    return { accessToken: result.accessToken, expiresAt: result.expiresAt, user: result.user };
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Refresh access token using httpOnly cookie' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.refreshToken;
    if (!token) throw new UnauthorizedException('No refresh token');
    const result = await this.auth.refresh(token);
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS);
    return { accessToken: result.accessToken, expiresAt: result.expiresAt, user: result.user };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Logout and clear refresh cookie' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.refreshToken;
    if (token) await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    return { success: true };
  }

  @Post('send-otp')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Send OTP to email' })
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.auth.sendOtp(dto.email);
  }

  @Post('verify-otp')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify OTP and login or register' })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.verifyOtp(dto.email, dto.code, dto.firstName, dto.lastName);
    if (!result) throw new BadRequestException('Invalid or expired code');
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS);
    return { accessToken: result.accessToken, expiresAt: result.expiresAt, user: result.user };
  }

  /** Only in development: reset admin & seller passwords to Admin123! / Seller123! so login works. */
  @Post('dev-reset-seed-users')
  @Public()
  @ApiOperation({ summary: '[DEV] Reset seed users passwords' })
  async devResetSeedUsers() {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Not available in production');
    }
    return this.auth.devResetSeedUsers();
  }
}
