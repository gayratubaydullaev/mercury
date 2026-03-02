'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTelegramWebApp } from '@/contexts/telegram-webapp-context';
import { useTelegramBackHandlerContext } from '@/contexts/telegram-back-handler-context';

/**
 * В Telegram Web App всегда показываем в шапке стрелку «назад» (BackButton).
 * По нажатию: сначала вызывается зарегистрированный обработчик (например закрытие модалки),
 * иначе переход по истории или подтверждение и закрытие приложения.
 */
export function TelegramBackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const { isTWA, webApp } = useTelegramWebApp();
  const { backHandlerRef } = useTelegramBackHandlerContext();

  useEffect(() => {
    if (!isTWA || !webApp?.BackButton) return;

    webApp.BackButton.show();

    const onBack = () => {
      const modalHandler = backHandlerRef.current;
      if (modalHandler) {
        modalHandler();
        return;
      }
      const isMainTwaPage = pathname === '/telegram-app';
      if (isMainTwaPage) {
        if (webApp.showConfirm) {
          webApp.showConfirm('Chiqish?', (ok: boolean) => {
            if (ok) webApp.close();
          });
        } else {
          webApp.close();
        }
      } else {
        router.back();
      }
    };

    webApp.BackButton.onClick(onBack);

    return () => {
      webApp.BackButton.hide();
    };
  }, [isTWA, webApp, pathname, router, backHandlerRef]);

  return null;
}
