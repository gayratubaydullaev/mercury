'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getTelegramWebApp, initTelegramWebApp } from '@/lib/telegram-webapp';

const EDGE_WIDTH = 24;
const SWIPE_THRESHOLD = 60;

/**
 * Инициализирует Telegram Web App (expand, отключение вертикальных свайпов, подтверждение выхода)
 * и обрабатывает свайп от левого края вправо как "назад" (router.back).
 * Настройки жестов повторно применяются при возврате на вкладку/фокус, чтобы клиент не сбрасывал их.
 */
export function TelegramWebAppInit({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const twaRef = useRef<ReturnType<typeof getTelegramWebApp>>(undefined);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const reinit = () => {
    const twa = getTelegramWebApp();
    if (twa) {
      twaRef.current = twa;
      initTelegramWebApp(twa);
    }
  };

  useEffect(() => {
    let done = false;
    const run = () => {
      const twa = getTelegramWebApp();
      if (twa && !done) {
        done = true;
        reinit();
        return;
      }
      if (!done) setTimeout(run, 50);
    };
    run();
  }, []);

  // Повторно применяем отключение вертикальных свайпов и подтверждение выхода при возврате в приложение
  useEffect(() => {
    const onVisible = () => reinit();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, []);

  // После навигации в подстраницах снова применяем настройки (часть клиентов сбрасывает после перехода)
  useEffect(() => {
    reinit();
  }, [pathname]);

  useEffect(() => {
    const el = document.documentElement;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const x = e.touches[0].clientX;
      if (x <= EDGE_WIDTH) touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      else touchStart.current = null;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current || e.changedTouches.length === 0) return;
      const end = e.changedTouches[0];
      const dx = end.clientX - touchStart.current.x;
      const dy = end.clientY - touchStart.current.y;
      touchStart.current = null;
      if (dx >= SWIPE_THRESHOLD && Math.abs(dy) < Math.abs(dx) * 0.6) {
        if (pathname && pathname !== '/telegram-app') router.back();
      }
    };
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [pathname, router]);

  return (
    <div className="min-h-screen min-h-[100dvh] touch-pan-y" style={{ touchAction: 'pan-y' }}>
      {children}
    </div>
  );
}
