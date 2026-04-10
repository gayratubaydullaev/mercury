import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from '@myshopuz/shared';
import { UserRole } from '@prisma/client';
import type { RequestAuthUser } from '../request-user.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private prisma: PrismaService
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) throw new Error('JWT_SECRET is required (set in .env and validated at bootstrap).');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<RequestAuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        isBlocked: true,
        firstName: true,
        lastName: true,
        staffShopId: true,
        staffShop: { select: { userId: true } },
      },
    });
    if (!user || user.isBlocked) throw new UnauthorizedException();
    if (user.role === UserRole.CASHIER && !user.staffShop) {
      throw new UnauthorizedException('Kassir hisobi doʻkonga bogʻlanmagan');
    }
    const effectiveSellerId =
      user.role === UserRole.SELLER
        ? user.id
        : user.role === UserRole.CASHIER && user.staffShop
          ? user.staffShop.userId
          : null;
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      staffShopId: user.staffShopId,
      effectiveSellerId,
      moderatorPermissions: payload.moderatorPermissions ?? undefined,
    };
  }
}
