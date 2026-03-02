'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useTelegramWebApp } from '@/contexts/telegram-webapp-context';
import { API_URL } from '@/lib/utils';

/**
 * При открытии Web App через Menu Button (или по любой ссылке в TWA) автоматически
 * выполняет вход/регистрацию по initData. Один запрос за сессию; бэкенд по telegramId
 * находит пользователя или создаёт нового (без дублирования).
 */
export function TelegramWebAppAuth() {
  const { setToken } = useAuth();
  const { isTWA, webApp, isReady } = useTelegramWebApp();
  const requested = useRef(false);

  useEffect(() => {
    if (!isReady || !isTWA || !webApp?.initData?.trim() || requested.current) return;

    const initData = webApp.initData.trim();
    requested.current = true;

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
      .catch(() => {
        requested.current = false; // allow retry on next mount if failed
      });
  }, [isReady, isTWA, webApp, setToken]);

  return null;
}
