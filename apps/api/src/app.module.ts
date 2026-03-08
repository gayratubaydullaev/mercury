import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CsrfMiddleware } from './common/csrf.middleware';
import { RlsInterceptor } from './common/rls.interceptor';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { CartModule } from './cart/cart.module';
import { CategoriesModule } from './categories/categories.module';
import { AdminModule } from './admin/admin.module';
import { UploadModule } from './upload/upload.module';
import { ChatModule } from './chat/chat.module';
import { ReviewsModule } from './reviews/reviews.module';
import { FavoritesModule } from './favorites/favorites.module';
import { PaymentsModule } from './payments/payments.module';
import { SellerModule } from './seller/seller.module';
import { SellerApplicationModule } from './seller-application/seller-application.module';
import { TelegramModule } from './telegram/telegram.module';
import { MailerModule } from './mailer/mailer.module';
import { BannersModule } from './banners/banners.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MailerModule,
    WinstonModule.forRoot({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({ format: winston.format.simple() }),
        ...(process.env.NODE_ENV === 'production'
          ? [new winston.transports.File({ filename: 'logs/error.log', level: 'error' })]
          : []),
      ],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const limitShort = parseInt(config.get('THROTTLE_LIMIT_SHORT') || '300', 10) || 300;
        const limitLong = parseInt(config.get('THROTTLE_LIMIT_LONG') || '2000', 10) || 2000;
        const redisUrl = config.get<string>('REDIS_URL');
        const useRedisStorage = redisUrl?.trim() && process.env.NODE_ENV === 'production';
        return {
          throttlers: [
            { name: 'short', ttl: 60000, limit: limitShort },
            { name: 'long', ttl: 86400000, limit: limitLong },
          ],
          ...(useRedisStorage && {
            storage: new ThrottlerStorageRedisService(redisUrl!),
          }),
        };
      },
    }),
    RedisModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    OrdersModule,
    CartModule,
    CategoriesModule,
    AdminModule,
    UploadModule,
    ChatModule,
    ReviewsModule,
    FavoritesModule,
    PaymentsModule,
    SellerModule,
    SellerApplicationModule,
    TelegramModule,
    BannersModule,
    SettingsModule,
  ],
  providers: [
    // Rate limit first, then JWT. ThrottlerGuard uses @Throttle() overrides on auth routes.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: RlsInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // CSRF: все POST/PUT/PATCH/DELETE требуют заголовок x-csrf-token. Исключения — только перечисленные ниже.
    consumer
      .apply(CsrfMiddleware)
      .exclude(
        // Авторизация
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'auth/register', method: RequestMethod.POST },
        { path: 'auth/refresh', method: RequestMethod.POST },
        { path: 'auth/logout', method: RequestMethod.POST },
        // OTP
        { path: 'auth/send-otp', method: RequestMethod.POST },
        { path: 'auth/verify-otp', method: RequestMethod.POST },
        { path: 'auth/telegram', method: RequestMethod.POST },
        { path: 'auth/telegram/request-login', method: RequestMethod.POST },
        // Разработка
        { path: 'auth/dev-reset-seed-users', method: RequestMethod.POST },
        // Пользователи
        { path: 'users/me', method: RequestMethod.PATCH },
        // Платежи (callback от провайдеров)
        { path: 'payments/click/callback', method: RequestMethod.POST },
        { path: 'payments/payme/callback', method: RequestMethod.POST },
        // Корзина — все эндпоинты
        { path: 'cart', method: RequestMethod.GET },
        { path: 'cart/items', method: RequestMethod.POST },
        { path: 'cart/items/:productId', method: RequestMethod.PATCH },
        { path: 'cart/items/:productId', method: RequestMethod.DELETE },
        // Заказы
        { path: 'orders', method: RequestMethod.POST },
      )
      .forRoutes('*');
  }
}
