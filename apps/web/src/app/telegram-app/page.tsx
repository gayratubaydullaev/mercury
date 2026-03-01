'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { API_URL } from '@/lib/utils';

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton: {
          show: () => void;
          hide: () => void;
          setText: (text: string) => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
        };
        BackButton: {
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
        };
        themeParams: { bg_color?: string; text_color?: string };
        setHeaderColor: (color: string) => void;
        initData: string;
        initDataUnsafe: { user?: { first_name?: string; username?: string } };
      };
    };
  }
}

export default function TelegramAppPage() {
  const [mounted, setMounted] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const { setToken } = useAuth();
  const twa = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;

  useEffect(() => {
    setMounted(true);
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setHeaderColor?.('#000000');
    }
  }, []);

  // Автоматическая регистрация/авторизация по initData при открытии из Telegram
  useEffect(() => {
    if (!mounted || !twa?.initData || authChecked) return;
    const initData = twa.initData.trim();
    if (!initData) {
      setAuthChecked(true);
      return;
    }
    fetch(`${API_URL}/auth/telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ initData }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((e) => Promise.reject(e));
        return res.json();
      })
      .then((data: { accessToken?: string }) => {
        if (data.accessToken) setToken(data.accessToken);
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, [mounted, twa?.initData, authChecked, setToken]);

  useEffect(() => {
    if (!mounted || !twa) return;
    twa.MainButton.setText("To'liq saytni ochish");
    twa.MainButton.show();
    const handler = () => {
      window.open(window.location.origin, '_blank');
    };
    twa.MainButton.onClick(handler);
    return () => {
      twa.MainButton.offClick(handler);
      twa.MainButton.hide();
    };
  }, [mounted, twa]);

  const userName =
    mounted && twa?.initDataUnsafe?.user?.first_name
      ? twa.initDataUnsafe.user.first_name
      : '';

  return (
    <main
      className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-4 text-center"
      style={{
        backgroundColor: twa?.themeParams?.bg_color || '#1a1a1a',
        color: twa?.themeParams?.text_color || '#ffffff',
      }}
    >
      <div className="max-w-sm w-full space-y-6">
        <h1 className="text-2xl font-bold">MyShopUZ</h1>
        {userName && (
          <p className="text-lg opacity-90">Salom, {userName}!</p>
        )}
        <p className="text-sm opacity-80">
          Telegram ichida doʻkon. Katalog, savatcha va buyurtmalar — quyidagi tugma orqali toʻliq saytda.
        </p>
        <div className="flex flex-col gap-3">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--tg-theme-button-color,#2481cc)] px-6 py-3 text-[var(--tg-theme-button-text-color,#fff)] font-medium no-underline"
          >
            Toʻliq saytni ochish
          </a>
          <Link
            href="/catalog"
            className="inline-flex items-center justify-center rounded-xl border border-[var(--tg-theme-button-color,#2481cc)] px-6 py-3 font-medium opacity-90"
            style={{ color: twa?.themeParams?.text_color || '#fff' }}
          >
            Katalog
          </Link>
        </div>
      </div>
    </main>
  );
}
