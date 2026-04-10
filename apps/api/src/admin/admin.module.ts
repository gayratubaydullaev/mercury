import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { TelegramModule } from '../telegram/telegram.module';
import { BannersModule } from '../banners/banners.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [AuthModule, TelegramModule, BannersModule, OrdersModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
