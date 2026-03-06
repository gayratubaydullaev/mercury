'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { API_URL } from '@/lib/utils';

const DEFAULT_SITE_NAME = 'JomboyShop';

type PublicSettings = { siteName: string };

const PublicSettingsContext = createContext<PublicSettings>({ siteName: DEFAULT_SITE_NAME });

export function PublicSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<PublicSettings>({ siteName: DEFAULT_SITE_NAME });

  useEffect(() => {
    if (!API_URL) return;
    fetch(`${API_URL}/settings/public`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { siteName?: string } | null) => {
        if (data?.siteName?.trim()) setSettings({ siteName: data.siteName.trim() });
      })
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
