import { MarketplaceMode, type PlatformSettings, type PrismaClient } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

/** DB without migration `20260410140000_marketplace_mode` has no `marketplace_mode` column. */
export function isMarketplaceModeColumnMissingError(e: unknown): boolean {
  if (e instanceof PrismaClientKnownRequestError) {
    if (e.code === 'P2022') return true;
  }
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes('marketplace_mode') && msg.includes('does not exist');
}

export async function getPlatformMarketplaceMode(prisma: PrismaClient): Promise<MarketplaceMode> {
  try {
    const row = await prisma.platformSettings.findFirst({ select: { marketplaceMode: true } });
    return row?.marketplaceMode ?? MarketplaceMode.MULTIVENDOR;
  } catch (e) {
    if (isMarketplaceModeColumnMissingError(e)) {
      return MarketplaceMode.MULTIVENDOR;
    }
    throw e;
  }
}

/** Columns that exist before `marketplace_mode` migration. */
export const PLATFORM_SETTINGS_LEGACY_SELECT = {
  id: true,
  siteName: true,
  commissionRate: true,
  minPayoutAmount: true,
  paymentClickEnabled: true,
  paymentPaymeEnabled: true,
  paymentCashEnabled: true,
  paymentCardOnDeliveryEnabled: true,
  deliveryEnabled: true,
  pickupEnabled: true,
  chatWithSellerEnabled: true,
  adminTelegramChatId: true,
  updatedAt: true,
} as const;

/**
 * Full row read; falls back to legacy columns + default marketplace mode if DB is unmigrated.
 */
export async function findFirstPlatformSettingsFull(prisma: PrismaClient): Promise<PlatformSettings | null> {
  try {
    return await prisma.platformSettings.findFirst();
  } catch (e) {
    if (!isMarketplaceModeColumnMissingError(e)) throw e;
    const row = await prisma.platformSettings.findFirst({
      select: PLATFORM_SETTINGS_LEGACY_SELECT,
    });
    if (!row) return null;
    return { ...row, marketplaceMode: MarketplaceMode.MULTIVENDOR } as PlatformSettings;
  }
}
