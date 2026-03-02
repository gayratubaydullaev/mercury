'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { API_URL } from '@/lib/utils';
import { getTelegramWebApp } from '@/lib/telegram-webapp';

export default function TelegramAppPage() {
  const [mounted, setMounted] = useState(false);
  const [tgReady, setTgReady] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const authRequested = useRef(false);
  const pathname = usePathname();
  const router = useRouter();
  const { setToken, isLoggedIn } = useAuth();
  const twa = typeof window !== 'undefined' ? getTelegramWebApp() : undefined;

  useEffect(() => {
    setMounted(true);
    if (getTelegramWebApp()) {
      setTgReady(true);
      return;
    }
    const interval = setInterval(() => {
      if (getTelegramWebApp()) {
        setTgReady(true);
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Авторизация по initData — запрос один раз после появления Telegram
  useEffect(() => {
    if (!mounted || !tgReady || authChecked || authRequested.current) return;
    const tg = getTelegramWebApp();
    const initData = tg?.initData?.trim();
    if (!initData) {
      setAuthChecked(true);
      return;
    }
    authRequested.current = true;
    fetch(`${API_URL}/auth/telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ initData }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((e: { message?: string }) => Promise.reject(new Error(e?.message || res.statusText)));
        return res.json();
      })
      .then((data: { accessToken?: string }) => {
        if (data.accessToken) setToken(data.accessToken);
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, [mounted, tgReady, authChecked, setToken]);

  useEffect(() => {
    if (!mounted || !tgReady || !twa) return;
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
  }, [mounted, tgReady, twa]);

  // Кнопка "назад": на подстраницах — переход в приложении; на главной /telegram-app — подтверждение и закрытие
  useEffect(() => {
    if (!mounted || !tgReady || !twa?.BackButton) return;
    twa.BackButton.show();
    const onBack = () => {
      if (pathname && pathname !== '/telegram-app') {
        router.back();
      } else {
        if (twa.showConfirm) {
          twa.showConfirm('Chiqish?', (ok: boolean) => {
            if (ok) twa.close();
          });
        } else {
          twa.close();
        }
      }
    };
    twa.BackButton.onClick(onBack);
    return () => twa.BackButton.hide();
  }, [mounted, tgReady, twa, pathname, router]);

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
          {isLoggedIn && (
            <Link
              href="/account"
              className="inline-flex items-center justify-center rounded-xl bg-[var(--tg-theme-button-color,#2481cc)] px-6 py-3 text-[var(--tg-theme-button-text-color,#fff)] font-medium no-underline"
            >
              Profil
            </Link>
          )}
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
