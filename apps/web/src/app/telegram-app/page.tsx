'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { useTelegramWebApp } from '@/contexts/telegram-webapp-context';

export default function TelegramAppPage() {
  const { isLoggedIn } = useAuth();
  const { isTWA, webApp: twa, isReady: tgReady } = useTelegramWebApp();
  const mounted = tgReady;

  // Авторизация по initData выполняется глобально в TelegramWebAppAuth при любом входе в TWA

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

  // BackButton (стрелка в шапке) управляется глобально в TelegramBackButton

  const userName =
    mounted && twa?.initDataUnsafe?.user?.first_name
      ? twa.initDataUnsafe.user.first_name
      : '';

  const bgColor = twa?.themeParams?.bg_color || '#1a1a1a';
  const textColor = twa?.themeParams?.text_color || '#ffffff';

  if (tgReady && !isTWA) {
    return (
      <main className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-4 text-center bg-background text-foreground">
        <div className="max-w-sm w-full space-y-6">
          <h1 className="text-2xl font-bold">Oline Bozor — Telegram</h1>
          <p className="text-sm text-muted-foreground">
            Bu sahifa Telegram Mini App sifatida ishlaydi. Bot orqali oching yoki toʻliq saytga oʻting.
          </p>
          <div className="flex flex-col gap-3">
            <a href="/" className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-primary-foreground font-medium no-underline">
              Toʻliq sayt
            </a>
            <Link href="/catalog" className="inline-flex items-center justify-center rounded-xl border border-input px-6 py-3 font-medium">
              Katalog
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-4 text-center"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      <div className="max-w-sm w-full space-y-6">
        <h1 className="text-2xl font-bold">Oline Bozor</h1>
        {userName && <p className="text-lg opacity-90">Salom, {userName}!</p>}
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
            style={{ color: textColor }}
          >
            Katalog
          </Link>
        </div>
      </div>
    </main>
  );
}
