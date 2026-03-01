import { Module } from '@nestjs/common';
import { SellerApplicationController } from './seller-application.controller';
import { SellerApplicationService } from './seller-application.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SellerApplicationController],
  providers: [SellerApplicationService],
  exports: [SellerApplicationService],
})
export class SellerApplicationModule {}
