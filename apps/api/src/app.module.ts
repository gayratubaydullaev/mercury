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
import { NotificationsModule } from './notifications/notifications.module';
import { CheckoutSessionModule } from './checkout-session/checkout-session.module';

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
        const throttleUseRedis = config.get<string>('THROTTLE_USE_REDIS') === 'true' && redisUrl?.trim();
        return {
          throttlers: [
            { name: 'short', ttl: 60000, limit: limitShort },
            { name: 'long', ttl: 86400000, limit: limitLong },
          ],
          ...(throttleUseRedis && {
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
    CheckoutSessionModule,
    SellerModule,
    SellerApplicationModule,
    TelegramModule,
    BannersModule,
    SettingsModule,
    NotificationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: RlsInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CsrfMiddleware)
      .exclude(
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'auth/register', method: RequestMethod.POST },
        { path: 'auth/refresh', method: RequestMethod.POST },
        { path: 'auth/logout', method: RequestMethod.POST },
        // OTP
        { path: 'auth/send-otp', method: RequestMethod.POST },
        { path: 'auth/verify-otp', method: RequestMethod.POST },
        { path: 'auth/telegram', method: RequestMethod.POST },
        { path: 'auth/telegram/request-login', method: RequestMethod.POST },
        { path: 'auth/dev-reset-seed-users', method: RequestMethod.POST },
        { path: 'users/me', method: RequestMethod.PATCH },
        { path: 'payments/click/callback', method: RequestMethod.POST },
        { path: 'payments/payme/callback', method: RequestMethod.POST },
        { path: 'cart', method: RequestMethod.GET },
        { path: 'cart/items', method: RequestMethod.POST },
        { path: 'cart/items/:productId', method: RequestMethod.PATCH },
        { path: 'cart/items/:productId', method: RequestMethod.DELETE },
        { path: 'orders', method: RequestMethod.POST },
        { path: 'checkout-session', method: RequestMethod.POST },
      )
      .forRoutes('*');
  }
}
