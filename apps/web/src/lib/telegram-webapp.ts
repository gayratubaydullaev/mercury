/**
 * Telegram Web App API types and helpers.
 * Script: https://telegram.org/js/telegram-web-app.js
 * Docs: https://core.telegram.org/bots/webapps
 */

export type TelegramThemeParams = {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
};

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
  themeParams: TelegramThemeParams;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  showConfirm?: (message: string, callback?: (ok: boolean) => void) => void;
  initData: string;
  initDataUnsafe: { user?: { first_name?: string; username?: string } };
  platform?: string;
  colorScheme?: 'light' | 'dark';
  /** API version (e.g. "6.0"); setHeaderColor, enableClosingConfirmation, disableVerticalSwipes требуют > 6.0 */
  version?: string;
  viewportStableHeight?: number;
  isExpanded?: boolean;
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

/** Поддерживает ли клиент опциональные методы (header color, closing confirmation, vertical swipes). В 6.0 они недоступны. */
function supportsOptionalWebAppMethods(twa: TelegramWebApp): boolean {
  const v = (twa as { version?: string }).version;
  if (v == null) return false;
  const num = parseFloat(v);
  return !Number.isNaN(num) && num > 6;
}

/** Инициализация Web App: развернуть, отключить вертикальные свайпы (закрытие), подтверждение выхода. */
export function initTelegramWebApp(twa: TelegramWebApp): void {
  twa.ready();
  twa.expand();
  // setHeaderColor, enableClosingConfirmation, disableVerticalSwipes не поддерживаются в API 6.0 — вызываем только если version > 6
  if (supportsOptionalWebAppMethods(twa)) {
    if (twa.setHeaderColor) twa.setHeaderColor('#000000');
    if (twa.enableClosingConfirmation) twa.enableClosingConfirmation();
    if (twa.disableVerticalSwipes) twa.disableVerticalSwipes();
  }
}
