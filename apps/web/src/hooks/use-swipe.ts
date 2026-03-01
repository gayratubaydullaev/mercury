'use client';

import { useCallback, useRef, useState } from 'react';

export interface UseSwipeOptions {
  /** Минимальная дистанция (px) для срабатывания свайпа. По умолчанию 50. */
  threshold?: number;
  /** Считать только горизонтальный свайп (игнорировать если вертикальное движение больше). По умолчанию true. */
  horizontalOnly?: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

/**
 * Хук для определения свайпа влево/вправо одним пальцем.
 * Возвращает обработчики для onTouchStart, onTouchMove, onTouchEnd.
 * На десктопе не используется (только touch).
 */
export function useSwipe(options: UseSwipeOptions) {
  const {
    threshold = 50,
    horizontalOnly = true,
    onSwipeLeft,
    onSwipeRight,
  } = options;

  const start = useRef<{ x: number; y: number } | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setIsSwiping(true);
    }
  }, []);

  const onTouchMove = useCallback((_e: React.TouchEvent) => {
    // движение можно отслеживать для визуальной обратной связи
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length > 0 || !start.current || e.changedTouches.length === 0) {
        if (e.touches.length === 0) {
          start.current = null;
          setIsSwiping(false);
        }
        return;
      }
      const end = e.changedTouches[0];
      const deltaX = end.clientX - start.current.x;
      const deltaY = end.clientY - start.current.y;
      start.current = null;
      setIsSwiping(false);

      if (horizontalOnly && Math.abs(deltaY) > Math.abs(deltaX)) return;
      if (Math.abs(deltaX) < threshold) return;

      if (deltaX < 0) onSwipeLeft?.();
      else onSwipeRight?.();
    },
    [threshold, horizontalOnly, onSwipeLeft, onSwipeRight]
  );

  return { onTouchStart, onTouchMove, onTouchEnd, isSwiping };
}
