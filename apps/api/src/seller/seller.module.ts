import { Module } from '@nestjs/common';
import { SellerController } from './seller.controller';
import { SellerStaffController } from './seller-staff.controller';
import { SellerService } from './seller.service';
import { SellerStaffService } from './seller-staff.service';
import { TelegramModule } from '../telegram/telegram.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TelegramModule, NotificationsModule],
  controllers: [SellerController, SellerStaffController],
  providers: [SellerService, SellerStaffService],
})
export class SellerModule {}
