'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getTelegramWebApp, initTelegramWebApp } from '@/lib/telegram-webapp';
import { useTelegramWebApp } from '@/contexts/telegram-webapp-context';

const EDGE_WIDTH = 24;
const SWIPE_THRESHOLD = 60;
const HISTORY_KEY = 'twa';

/**
 * Инициализирует Telegram Web App, применяет Sticky App (CSS), перехват popstate для жеста «назад».
 * Sticky: body overflow hidden + внутренний скролл — вертикальные свайпы не уходят в Telegram и не закрывают окно.
 */
export function TelegramWebAppInit({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isTWA } = useTelegramWebApp();
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const popstateHandled = useRef(false);

  const reinit = () => {
    const twa = getTelegramWebApp();
    if (twa) initTelegramWebApp(twa);
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

  useEffect(() => {
    reinit();
  }, [pathname]);

  // Sticky App: при isTWA — body overflow hidden, скролл только внутри обёртки (свайп вниз не закрывает окно)
  useEffect(() => {
    if (!isTWA || typeof document === 'undefined') return;
    document.body.classList.add('twa-sticky-body');
    return () => {
      document.body.classList.remove('twa-sticky-body');
    };
  }, [isTWA]);

  // Пытаемся перехватить жест «назад»: лишняя запись в history; при popstate снова pushState, чтобы остаться в приложении
  useEffect(() => {
    if (!isTWA || typeof window === 'undefined') return;
    const state = { [HISTORY_KEY]: pathname || '/telegram-app' };
    window.history.pushState(state, '', window.location.href);
    const onPopState = () => {
      if (popstateHandled.current) return;
      popstateHandled.current = true;
      // Остаёмся на текущей странице: снова pushState, чтобы «съесть» жест назад
      window.history.pushState({ [HISTORY_KEY]: pathname || '/telegram-app' }, '', window.location.href);
      setTimeout(() => {
        popstateHandled.current = false;
      }, 50);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isTWA, pathname]);

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

  const content = (
    <div className="min-h-screen min-h-[100dvh] touch-pan-y" style={{ touchAction: 'pan-y' }}>
      {children}
    </div>
  );

  if (isTWA) {
    return (
      <div className="twa-sticky-wrap">
        <div className="twa-sticky-content">{content}</div>
      </div>
    );
  }

  return content;
}
