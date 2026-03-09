import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CheckoutSessionController } from './checkout-session.controller';
import { CheckoutSessionService } from './checkout-session.service';

@Module({
  imports: [PrismaModule],
  controllers: [CheckoutSessionController],
  providers: [CheckoutSessionService],
  exports: [CheckoutSessionService],
})
export class CheckoutSessionModule {}
