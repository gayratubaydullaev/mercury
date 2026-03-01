'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageLightboxProps {
  images: { url: string; alt?: string | null }[];
  initialIndex?: number;
  title?: string;
  open: boolean;
  onClose: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;
const SWIPE_THRESHOLD_PX = 50;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP_PX = 30;

export function ImageLightbox({ images, initialIndex = 0, title, open, onClose }: ImageLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, translateX: 0, translateY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{ initialDistance: number; initialScale: number; centerX: number; centerY: number; translateX: number; translateY: number } | null>(null);
  const touchDragStart = useRef<{ x: number; y: number; translateX: number; translateY: number } | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  useEffect(() => {
    if (open) {
      setIndex(initialIndex);
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    }
  }, [open, initialIndex]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex((i) => (i <= 0 ? images.length - 1 : i - 1));
      if (e.key === 'ArrowRight') setIndex((i) => (i >= images.length - 1 ? 0 : i + 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, images.length, onClose]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !open) return;
    const prevent = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        return;
      }
      if (e.touches.length === 1 && scaleRef.current > 1 && touchDragStart.current !== null) {
        e.preventDefault();
        return;
      }
      if (e.touches.length === 1 && scaleRef.current <= 1 && swipeStart.current !== null) {
        e.preventDefault();
      }
    };
    el.addEventListener('touchmove', prevent, { passive: false });
    return () => el.removeEventListener('touchmove', prevent);
  }, [open]);

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(MAX_ZOOM, s + ZOOM_STEP));
    setTranslate({ x: 0, y: 0 });
  }, []);
  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(MIN_ZOOM, s - ZOOM_STEP));
    setTranslate({ x: 0, y: 0 });
  }, []);
  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const goPrev = useCallback(() => {
    setIndex((i) => (i <= 0 ? images.length - 1 : i - 1));
    resetZoom();
  }, [images.length, resetZoom]);
  const goNext = useCallback(() => {
    setIndex((i) => (i >= images.length - 1 ? 0 : i + 1));
    resetZoom();
  }, [images.length, resetZoom]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (scale <= 1) return;
      e.preventDefault();
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        translateX: translate.x,
        translateY: translate.y,
      };
    },
    [scale, translate]
  );
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || scale <= 1) return;
      setTranslate({
        x: dragStart.current.translateX + e.clientX - dragStart.current.x,
        y: dragStart.current.translateY + e.clientY - dragStart.current.y,
      });
    },
    [isDragging, scale]
  );
  const handleMouseUp = useCallback(() => setIsDragging(false), []);
  const handleMouseLeave = useCallback(() => setIsDragging(false), []);

  const getTouchDistance = useCallback((a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }) => {
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
  }, []);
  const getTouchCenter = useCallback((a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }) => ({
    x: (a.clientX + b.clientX) / 2,
    y: (a.clientY + b.clientY) / 2,
  }), []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const center = getTouchCenter(e.touches[0], e.touches[1]);
        pinchRef.current = {
          initialDistance: getTouchDistance(e.touches[0], e.touches[1]),
          initialScale: scale,
          centerX: center.x,
          centerY: center.y,
          translateX: translate.x,
          translateY: translate.y,
        };
        touchDragStart.current = null;
      } else if (e.touches.length === 1 && scale > 1) {
        touchDragStart.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          translateX: translate.x,
          translateY: translate.y,
        };
        pinchRef.current = null;
        swipeStart.current = null;
      } else if (e.touches.length === 1 && scale <= 1) {
        swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        touchDragStart.current = null;
        pinchRef.current = null;
      } else {
        touchDragStart.current = null;
        pinchRef.current = null;
        swipeStart.current = null;
      }
    },
    [scale, translate, getTouchDistance, getTouchCenter]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const dist = getTouchDistance(e.touches[0], e.touches[1]);
        const ratio = dist / pinchRef.current.initialDistance;
        const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchRef.current.initialScale * ratio));
        setScale(newScale);
        const center = getTouchCenter(e.touches[0], e.touches[1]);
        const dx = center.x - pinchRef.current.centerX;
        const dy = center.y - pinchRef.current.centerY;
        setTranslate({
          x: pinchRef.current.translateX + dx,
          y: pinchRef.current.translateY + dy,
        });
      } else if (e.touches.length === 1 && touchDragStart.current && scale > 1) {
        e.preventDefault();
        setTranslate({
          x: touchDragStart.current.translateX + e.touches[0].clientX - touchDragStart.current.x,
          y: touchDragStart.current.translateY + e.touches[0].clientY - touchDragStart.current.y,
        });
      }
    },
    [scale, getTouchDistance, getTouchCenter]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current = null;
      if (e.touches.length < 1) touchDragStart.current = null;

      if (e.touches.length === 0 && e.changedTouches.length > 0) {
        const end = e.changedTouches[0];

        if (swipeStart.current && scaleRef.current <= 1 && images.length > 1) {
          const deltaX = end.clientX - swipeStart.current.x;
          const deltaY = end.clientY - swipeStart.current.y;
          if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD_PX) {
            if (deltaX < 0) goNext();
            else goPrev();
            swipeStart.current = null;
            lastTap.current = null;
            return;
          }
        }
        swipeStart.current = null;

        const now = Date.now();
        if (lastTap.current && now - lastTap.current.time < DOUBLE_TAP_MS &&
            Math.abs(end.clientX - lastTap.current.x) < DOUBLE_TAP_SLOP_PX &&
            Math.abs(end.clientY - lastTap.current.y) < DOUBLE_TAP_SLOP_PX) {
          setScale((s) => (s > 1 ? 1 : 2));
          setTranslate({ x: 0, y: 0 });
          lastTap.current = null;
          return;
        }
        lastTap.current = { time: now, x: end.clientX, y: end.clientY };
      } else if (e.touches.length === 0) {
        swipeStart.current = null;
      }
    },
    [images.length, goNext, goPrev]
  );

  if (!open || !images?.length) return null;

  const current = images[index];
  const alt = current?.alt ?? title ?? `Rasm ${index + 1}`;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-3 md:p-4 bg-gradient-to-b from-black/60 to-transparent z-10">
        <span className="text-white/90 text-sm md:text-base">
          {index + 1} / {images.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={zoomOut}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Kichiklashtirish"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors text-xs font-medium min-w-[2.5rem]"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            onClick={zoomIn}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Kattalashtirish"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white hover:bg-white/30 transition-colors"
            aria-label="Yopish"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Prev/Next for multiple images */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-10 p-2 md:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Oldingi"
          >
            <ChevronLeft className="h-6 w-6 md:h-8 md:w-8" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-10 p-2 md:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Keyingi"
          >
            <ChevronRight className="h-6 w-6 md:h-8 md:w-8" />
          </button>
        </>
      )}

      <div
        ref={containerRef}
        className="flex-1 min-h-0 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none touch-pan-y"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={() => { setScale((s) => (s > 1 ? 1 : 2)); setTranslate({ x: 0, y: 0 }); }}
      >
        <div
          className={cn(
            'relative transition-transform duration-150 ease-out',
            isDragging && 'cursor-grabbing'
          )}
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          }}
        >
          <Image
            src={current.url}
            alt={alt}
            width={1200}
            height={1200}
            className="max-w-[90vw] max-h-[85vh] w-auto h-auto object-contain pointer-events-none"
            unoptimized
            draggable={false}
            priority
          />
        </div>
      </div>

      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIndex(i);
                resetZoom();
              }}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === index ? 'bg-white w-5' : 'bg-white/50 w-1.5 hover:bg-white/70'
              )}
              aria-label={`Rasm ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
