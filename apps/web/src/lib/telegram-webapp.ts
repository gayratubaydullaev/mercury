/**
 * Telegram Web App API types and helpers.
 * Script: https://telegram.org/js/telegram-web-app.js
 */

export type TelegramWebApp = {
  ready: () => void;
  expand: () => void;
  close: () => void;
  enableClosingConfirmation?: () => void;
  disableVerticalSwipes?: () => void;
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
  themeParams: { bg_color?: string; text_color?: string; button_color?: string };
  setHeaderColor?: (color: string) => void;
  showConfirm?: (message: string, callback?: (ok: boolean) => void) => void;
  initData: string;
  initDataUnsafe: { user?: { first_name?: string; username?: string } };
};

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

export function getTelegramWebApp(): TelegramWebApp | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.Telegram?.WebApp;
}

/** Инициализация Web App: развернуть, отключить вертикальные свайпы (закрытие), подтверждение выхода. */
export function initTelegramWebApp(twa: TelegramWebApp): void {
  twa.ready();
  twa.expand();
  if (twa.setHeaderColor) twa.setHeaderColor('#000000');
  if (twa.enableClosingConfirmation) twa.enableClosingConfirmation();
  if (twa.disableVerticalSwipes) twa.disableVerticalSwipes();
}
