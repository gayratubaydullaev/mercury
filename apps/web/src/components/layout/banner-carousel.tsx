'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSwipe } from '@/hooks/use-swipe';

export interface BannerSlide {
  image: string;
  href: string;
  external?: boolean;
  title?: string;
}

const INTERVAL_MS = 5000;
const PROGRESS_TICK_MS = 80;

const ReklamaBadge = () => (
  <div
    className="absolute top-3 right-3 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/40 backdrop-blur-md text-[10px] text-white/95 font-semibold tracking-widest uppercase border border-white/15 shadow-lg"
    aria-hidden
  >
    <Megaphone className="w-3.5 h-3.5 text-amber-300/90" />
    Reklama
  </div>
);

const TitleOverlay = ({ title }: { title: string }) => (
  <div className="absolute inset-x-0 bottom-0 z-20 p-4 pt-12 bg-gradient-to-t from-black/70 via-black/30 to-transparent rounded-b-[1.5rem] pointer-events-none">
    <p className="text-white text-sm font-medium drop-shadow-md line-clamp-2">{title}</p>
  </div>
);

export function BannerCarousel({ slides = [], intervalMs = INTERVAL_MS }: { slides?: BannerSlide[]; intervalMs?: number }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const slideStartRef = useRef(Date.now());

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(typeof window !== 'undefined' && window.innerWidth >= 768);
    checkDesktop();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', checkDesktop);
      return () => window.removeEventListener('resize', checkDesktop);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const shouldAutoAdvance = slides.length > 1 && !isPaused && !prefersReducedMotion;

  useEffect(() => {
    if (!shouldAutoAdvance) return;
    slideStartRef.current = Date.now();
    setProgress(0);
    const tick = setInterval(() => {
      const elapsed = Date.now() - slideStartRef.current;
      const pct = Math.min((elapsed / intervalMs) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        setCurrentIndex((prev) => (prev + 1) % slides.length);
        slideStartRef.current = Date.now();
      }
    }, PROGRESS_TICK_MS);
    return () => clearInterval(tick);
  }, [slides.length, intervalMs, shouldAutoAdvance]);

  const goTo = useCallback((index: number) => {
    slideStartRef.current = Date.now();
    setCurrentIndex(index);
    setProgress(0);
  }, []);
  const goPrev = useCallback(() => {
    slideStartRef.current = Date.now();
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
    setProgress(0);
  }, [slides.length]);
  const goNext = useCallback(() => {
    slideStartRef.current = Date.now();
    setCurrentIndex((prev) => (prev + 1) % slides.length);
    setProgress(0);
  }, [slides.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext]);

  const swipe = useSwipe({
    threshold: 50,
    horizontalOnly: true,
    onSwipeLeft: goNext,
    onSwipeRight: goPrev,
  });

  if (slides.length === 0) return null;

  const slide = slides[currentIndex];
  const isMobile = !isDesktop;

  const getPosition = (index: number) => {
    if (index === currentIndex) return 'center';
    if (index === (currentIndex - 1 + slides.length) % slides.length) return 'left';
    if (index === (currentIndex + 1) % slides.length) return 'right';
    return 'hidden';
  };

  const variants = {
    center: { x: '0%', scale: 1, zIndex: 20, opacity: 1 },
    left: isDesktop
      ? { x: '-75%', scale: 0.8, zIndex: 10, opacity: 0.92 }
      : { x: '-100%', scale: 1, zIndex: 10, opacity: 0 },
    right: isDesktop
      ? { x: '75%', scale: 0.8, zIndex: 10, opacity: 0.92 }
      : { x: '100%', scale: 1, zIndex: 10, opacity: 0 },
    hidden: { x: '0%', scale: 0.5, zIndex: 0, opacity: 0 },
  };

  return (
    <section
      className="w-full px-3 md:px-0 pt-2 md:pt-4 pb-0 md:pb-1 overflow-hidden"
      aria-roledescription="carousel"
      aria-label="Reklama bannerlari"
    >
      <div
        className="relative w-full max-w-[100vw] aspect-[16/9] md:aspect-[5/1] flex items-center justify-center group touch-pan-y contain-paint"
        onTouchStart={swipe.onTouchStart}
        onTouchMove={swipe.onTouchMove}
        onTouchEnd={swipe.onTouchEnd}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {isMobile ? (
          <div className="absolute inset-0 w-full h-full overflow-hidden shadow-2xl ring-1 ring-black/10 bg-card rounded-2xl md:rounded-[1.5rem]">
            <div className="relative w-full h-full select-none overflow-hidden rounded-2xl md:rounded-[1.5rem]">
              <ReklamaBadge />
              {slide.href ? (
                <Link
                  href={slide.href}
                  className="relative block w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-2xl"
                  {...(slide.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  <Image
                    src={slide.image}
                    alt={slide.title ?? 'Reklama'}
                    fill
                    className="object-cover rounded-2xl"
                    priority
                    sizes="(max-width: 768px) 100vw, 50vw"
                    unoptimized={slide.image.startsWith('http')}
                  />
                  {slide.title && <TitleOverlay title={slide.title} />}
                </Link>
              ) : (
                <>
                  <Image
                    src={slide.image}
                    alt={slide.title ?? 'Reklama'}
                    fill
                    className="object-cover rounded-2xl"
                    priority
                    sizes="(max-width: 768px) 100vw, 50vw"
                    unoptimized={slide.image.startsWith('http')}
                  />
                  {slide.title && <TitleOverlay title={slide.title} />}
                </>
              )}
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            {slides.map((slide, index) => {
              const position = getPosition(index);
              const isHidden = position === 'hidden' && slides.length > 2;
              if (isHidden) return null;

              const isCenter = position === 'center';

              return (
                <motion.div
                  key={index}
                  variants={variants}
                  initial="hidden"
                  animate={position}
                  transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className={cn(
                    'absolute w-full md:w-[40%] h-full overflow-hidden shadow-2xl ring-1 ring-black/10 bg-card rounded-2xl md:rounded-[1.5rem]',
                    isCenter ? 'z-20 cursor-pointer ring-2 ring-primary/20' : 'z-10 cursor-pointer'
                  )}
                  onClick={() => {
                    if (position === 'left') goPrev();
                    if (position === 'right') goNext();
                  }}
                >
                  <div className="relative w-full h-full select-none overflow-hidden rounded-2xl md:rounded-[1.5rem]">
                    <ReklamaBadge />
                    {isCenter && slide.href ? (
                      <Link
                        href={slide.href}
                        className="relative block w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-2xl"
                        {...(slide.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      >
                        <Image
                          src={slide.image}
                          alt={slide.title ?? 'Reklama'}
                          fill
                          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105 rounded-2xl"
                          priority={index === 0}
                          sizes="(max-width: 768px) 100vw, 45vw"
                          unoptimized={slide.image.startsWith('http')}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl" aria-hidden />
                        {slide.title && <TitleOverlay title={slide.title} />}
                      </Link>
                    ) : (
                      <>
                        <Image
                          src={slide.image}
                          alt={slide.title ?? 'Reklama'}
                          fill
                          className="object-cover rounded-2xl"
                          priority={index === 0}
                          sizes="(max-width: 768px) 100vw, 45vw"
                          unoptimized={slide.image.startsWith('http')}
                        />
                        {slide.title && <TitleOverlay title={slide.title} />}
                        {!isCenter && (
                          <div className="absolute inset-0 bg-foreground/10 rounded-2xl" aria-hidden />
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {slides.length > 1 && isDesktop && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-white/95 dark:bg-card shadow-lg border border-border flex items-center justify-center text-foreground opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 hover:bg-white dark:hover:bg-card active:scale-95 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Oldingi reklama"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-white/95 dark:bg-card shadow-lg border border-border flex items-center justify-center text-foreground opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 hover:bg-white dark:hover:bg-card active:scale-95 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Keyingi reklama"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {slides.length > 1 && (
          <div className="absolute bottom-3 md:bottom-4 left-0 right-0 flex flex-col items-center gap-2.5 z-30 px-4">
            <div className="flex items-center gap-2">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => goTo(idx)}
                  className={cn(
                    'rounded-full transition-all duration-300 shrink-0 h-2 border border-primary/40',
                    idx === currentIndex
                      ? 'bg-primary w-8 shadow-md shadow-primary/30'
                      : 'w-2 bg-white/70 dark:bg-white/40 hover:bg-white/90 hover:w-3'
                  )}
                  aria-label={`Banner ${idx + 1}`}
                  aria-current={idx === currentIndex ? 'true' : undefined}
                />
              ))}
            </div>
            <div className="w-full max-w-[140px] h-1 bg-white/40 dark:bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
              <motion.div
                className="h-full bg-white rounded-full shadow-sm"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.15, ease: 'linear' }}
              />
            </div>
            <span className="sr-only" aria-live="polite">
              {currentIndex + 1} / {slides.length}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
