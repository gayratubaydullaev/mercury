import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { TelegramModule } from '../telegram/telegram.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [TelegramModule, OrdersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
