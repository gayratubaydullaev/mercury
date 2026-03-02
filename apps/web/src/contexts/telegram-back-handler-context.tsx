'use client';

import { createContext, useCallback, useContext, useEffect, useRef } from 'react';

type BackHandler = (() => void) | null;

type TelegramBackHandlerContextValue = {
  /** Текущий обработчик «назад» (например, закрытие модалки). BackButton вызывает его первым. */
  backHandlerRef: React.MutableRefObject<BackHandler>;
  /** Установить обработчик. Вызвать с null при размонтировании или закрытии модалки. */
  setBackHandler: (fn: BackHandler) => void;
};

const defaultRef = { current: null as BackHandler };

const TelegramBackHandlerContext = createContext<TelegramBackHandlerContextValue>({
  backHandlerRef: defaultRef,
  setBackHandler: () => {},
});

export function TelegramBackHandlerProvider({ children }: { children: React.ReactNode }) {
  const backHandlerRef = useRef<BackHandler>(null);

  const setBackHandler = useCallback((fn: BackHandler) => {
    backHandlerRef.current = fn;
  }, []);

  const value: TelegramBackHandlerContextValue = {
    backHandlerRef,
    setBackHandler,
  };

  return (
    <TelegramBackHandlerContext.Provider value={value}>
      {children}
    </TelegramBackHandlerContext.Provider>
  );
}

export function useTelegramBackHandlerContext() {
  return useContext(TelegramBackHandlerContext);
}

/**
 * Регистрирует обработчик «назад» для TWA: при открытом модале стрелка в шапке сначала закроет модал.
 * Использовать в компонентах модалок: useTelegramBackHandler(open, () => onOpenChange(false)).
 */
export function useTelegramBackHandler(open: boolean, onBack: () => void) {
  const { setBackHandler } = useTelegramBackHandlerContext();
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (open) {
      const handler = () => onBackRef.current();
      setBackHandler(handler);
      return () => setBackHandler(null);
    }
    setBackHandler(null);
  }, [open, setBackHandler]);
}
