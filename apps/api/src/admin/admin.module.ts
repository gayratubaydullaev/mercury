import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { TelegramModule } from '../telegram/telegram.module';
import { BannersModule } from '../banners/banners.module';

@Module({
  imports: [TelegramModule, BannersModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
