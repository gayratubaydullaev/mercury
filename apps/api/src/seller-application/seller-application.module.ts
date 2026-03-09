import { Module } from '@nestjs/common';
import { SellerApplicationController } from './seller-application.controller';
import { SellerApplicationService } from './seller-application.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramModule } from '../telegram/telegram.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, TelegramModule, NotificationsModule],
  controllers: [SellerApplicationController],
  providers: [SellerApplicationService],
  exports: [SellerApplicationService],
})
export class SellerApplicationModule {}
