'use client';

import { useEffect } from 'react';
import { useTelegramWebApp } from '@/contexts/telegram-webapp-context';

/**
 * When the app runs inside Telegram Web App, sets data-telegram-webapp on body.
 * Telegram script already injects --tg-theme-* CSS variables; this allows targeting TWA in CSS.
 */
export function TelegramThemeApplicator() {
  const { isTWA, isReady } = useTelegramWebApp();

  useEffect(() => {
    if (!isReady || typeof document === 'undefined') return;
    const body = document.body;
    if (isTWA) body.setAttribute('data-telegram-webapp', 'true');
    else body.removeAttribute('data-telegram-webapp');
    return () => body.removeAttribute('data-telegram-webapp');
  }, [isTWA, isReady]);

  return null;
}
