'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { API_URL } from '@/lib/utils';

const DEFAULT_SITE_NAME = 'Oline Bozor';

export type MarketplaceMode = 'MULTIVENDOR' | 'SINGLE_SHOP';

type PublicSettings = {
  siteName: string;
  marketplaceMode: MarketplaceMode;
  newSellerApplicationsOpen: boolean;
};

const defaultSettings: PublicSettings = {
  siteName: DEFAULT_SITE_NAME,
  marketplaceMode: 'MULTIVENDOR',
  newSellerApplicationsOpen: true,
};

const PublicSettingsContext = createContext<PublicSettings>(defaultSettings);

export function PublicSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<PublicSettings>(defaultSettings);

  useEffect(() => {
    if (!API_URL) return;
    fetch(`${API_URL}/settings/public`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (data: {
          siteName?: string;
          marketplaceMode?: MarketplaceMode;
          newSellerApplicationsOpen?: boolean;
        } | null) => {
          if (!data) return;
          setSettings({
            siteName: data.siteName?.trim() || DEFAULT_SITE_NAME,
            marketplaceMode:
              data.marketplaceMode === 'SINGLE_SHOP' ? 'SINGLE_SHOP' : 'MULTIVENDOR',
            newSellerApplicationsOpen: data.newSellerApplicationsOpen !== false,
          });
        }
      )
      .catch(() => {});
  }, []);

  return (
    <PublicSettingsContext.Provider value={settings}>
      {children}
    </PublicSettingsContext.Provider>
  );
}

export function usePublicSettings(): PublicSettings {
  return useContext(PublicSettingsContext);
}
