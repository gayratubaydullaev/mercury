'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getTelegramWebApp,
  initTelegramWebApp,
  type TelegramThemeParams,
  type TelegramWebApp,
} from '@/lib/telegram-webapp';

type TelegramWebAppContextValue = {
  /** True when the app is running inside Telegram (Web App with initData). */
  isTWA: boolean;
  /** Telegram Web App API or null when not in TWA. */
  webApp: TelegramWebApp | null;
  /** Theme params from Telegram (colors, etc.). */
  themeParams: TelegramThemeParams;
  /** True when the script has been checked and TWA state is known. */
  isReady: boolean;
  /** Platform from Telegram (e.g. "android", "ios", "web"). */
  platform: string;
  /** "light" | "dark" from Telegram. */
  colorScheme: 'light' | 'dark' | undefined;
  /** Re-run init (expand, disableVerticalSwipes, etc.) — call after navigation or visibility change. */
  reinit: () => void;
};

const defaultValue: TelegramWebAppContextValue = {
  isTWA: false,
  webApp: null,
  themeParams: {},
  isReady: false,
  platform: '',
  colorScheme: undefined,
  reinit: () => {},
};

const TelegramWebAppContext = createContext<TelegramWebAppContextValue>(defaultValue);

const TELEGRAM_SCRIPT_SRC = 'https://telegram.org/js/telegram-web-app.js?60';

/**
 * Loads the Telegram Web App script once and provides TWA state to the tree.
 * Use when you want the script available on all routes (site + web app + TWA in one).
 */
export function TelegramWebAppProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);

  const reinit = useCallback(() => {
    const twa = getTelegramWebApp();
    if (twa) {
      initTelegramWebApp(twa);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.Telegram?.WebApp) {
      const twa = getTelegramWebApp()!;
      setWebApp(twa);
      initTelegramWebApp(twa);
      setIsReady(true);
      return;
    }
    const script = document.createElement('script');
    script.src = TELEGRAM_SCRIPT_SRC;
    script.async = false;
    script.onload = () => {
      const twa = getTelegramWebApp();
      if (twa) {
        setWebApp(twa);
        initTelegramWebApp(twa);
      }
      setIsReady(true);
    };
    script.onerror = () => setIsReady(true);
    document.head.appendChild(script);
    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  const value = useMemo<TelegramWebAppContextValue>(() => {
    const twa = webApp;
    const hasInitData = !!(twa?.initData?.trim());
    return {
      isTWA: hasInitData,
      webApp: twa,
      themeParams: twa?.themeParams ?? {},
      isReady,
      platform: twa?.platform ?? '',
      colorScheme: (twa?.colorScheme as 'light' | 'dark') ?? undefined,
      reinit,
    };
  }, [webApp, isReady, reinit]);

  return (
    <TelegramWebAppContext.Provider value={value}>
      {children}
    </TelegramWebAppContext.Provider>
  );
}

export function useTelegramWebApp(): TelegramWebAppContextValue {
  const ctx = useContext(TelegramWebAppContext);
  return ctx ?? defaultValue;
}
