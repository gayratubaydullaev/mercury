import { Injectable } from '@nestjs/common';
import { MarketplaceMode } from '@prisma/client';
import { isMarketplaceModeColumnMissingError } from '../common/platform-settings-compat';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getPublicSettings(): Promise<{
    siteName: string;
    marketplaceMode: MarketplaceMode;
    newSellerApplicationsOpen: boolean;
  }> {
    let siteName = 'Oline Bozor';
    let marketplaceMode: MarketplaceMode = MarketplaceMode.MULTIVENDOR;
    try {
      const settings = await this.prisma.platformSettings.findFirst({
        select: { siteName: true, marketplaceMode: true },
      });
      if (settings?.siteName?.trim()) siteName = settings.siteName.trim();
      if (settings?.marketplaceMode != null) marketplaceMode = settings.marketplaceMode;
    } catch (e) {
      if (!isMarketplaceModeColumnMissingError(e)) throw e;
      const row = await this.prisma.platformSettings.findFirst({ select: { siteName: true } });
      if (row?.siteName?.trim()) siteName = row.siteName.trim();
    }
    const shopCount = await this.prisma.shop.count();
    const newSellerApplicationsOpen =
      marketplaceMode === MarketplaceMode.MULTIVENDOR || shopCount === 0;
    return { siteName, marketplaceMode, newSellerApplicationsOpen };
  }

  async getCheckoutOptions(): Promise<{ paymentMethods: string[]; deliveryTypes: string[]; chatWithSellerEnabled: boolean }> {
    const settings = await this.prisma.platformSettings.findFirst({
      select: {
        paymentClickEnabled: true,
        paymentPaymeEnabled: true,
        paymentCashEnabled: true,
        paymentCardOnDeliveryEnabled: true,
        deliveryEnabled: true,
        pickupEnabled: true,
        chatWithSellerEnabled: true,
      },
    });
    const paymentMethods: string[] = [];
    if (settings?.paymentClickEnabled) paymentMethods.push('CLICK');
    if (settings?.paymentPaymeEnabled) paymentMethods.push('PAYME');
    if (settings?.paymentCashEnabled) paymentMethods.push('CASH');
    if (settings?.paymentCardOnDeliveryEnabled) paymentMethods.push('CARD_ON_DELIVERY');
    if (paymentMethods.length === 0) paymentMethods.push('CASH'); // fallback
    const deliveryTypes: string[] = [];
    if (settings?.deliveryEnabled) deliveryTypes.push('DELIVERY');
    if (settings?.pickupEnabled) deliveryTypes.push('PICKUP');
    if (deliveryTypes.length === 0) deliveryTypes.push('DELIVERY', 'PICKUP'); // fallback
    const chatWithSellerEnabled = settings?.chatWithSellerEnabled ?? true;
    return { paymentMethods, deliveryTypes, chatWithSellerEnabled };
  }
}
