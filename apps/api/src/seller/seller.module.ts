import { Module } from '@nestjs/common';
import { SellerController } from './seller.controller';
import { SellerService } from './seller.service';
import { TelegramModule } from '../telegram/telegram.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TelegramModule, NotificationsModule],
  controllers: [SellerController],
  providers: [SellerService],
})
export class SellerModule {}
