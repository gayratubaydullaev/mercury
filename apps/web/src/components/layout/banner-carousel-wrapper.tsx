'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/utils';
import { BannerCarousel, type BannerSlide } from './banner-carousel';
import { cn } from '@/lib/utils';

const CACHE_TTL_MS = 60_000;

function BannerSkeleton() {
  return (
    <section className="w-full px-3 md:px-0 pt-2 md:pt-4 pb-0 md:pb-1 overflow-hidden" aria-hidden>
      <div
        className={cn(
          'w-full max-w-[100vw] aspect-[16/9] md:aspect-[5/1] rounded-2xl md:rounded-[1.5rem]',
          'bg-muted/80 animate-pulse ring-1 ring-border/50'
        )}
      />
    </section>
  );
}

const DEFAULT_INTERVAL_MS = 5000;

function normalizeBanners(data: unknown): { slides: BannerSlide[]; intervalMs: number } {
  const list = Array.isArray(data) ? data : [];
  const slides: BannerSlide[] = list.map((b: { image: string; href: string; external?: boolean; title?: string | null }) => ({
    image: b.image,
    href: b.href,
    external: b.external,
    title: b.title ?? undefined,
  }));
  const first = list[0] as { displaySeconds?: number | null } | undefined;
  const intervalMs = first?.displaySeconds != null && first.displaySeconds > 0
    ? first.displaySeconds * 1000
    : DEFAULT_INTERVAL_MS;
  return { slides, intervalMs };
}

let cachedSlides: BannerSlide[] | null = null;
let cacheTime = 0;

let cachedIntervalMs = DEFAULT_INTERVAL_MS;

export function BannerCarouselWrapper() {
  const pathname = usePathname();
  const [slides, setSlides] = useState<BannerSlide[]>(() => (pathname === '/' && cachedSlides ? cachedSlides : []));
  const [intervalMs, setIntervalMs] = useState(DEFAULT_INTERVAL_MS);
  const [loading, setLoading] = useState(() => pathname === '/' && !cachedSlides);

  useEffect(() => {
    if (pathname !== '/') return;

    const useCache = cachedSlides && Date.now() - cacheTime < CACHE_TTL_MS;
    if (useCache) {
      setSlides(cachedSlides!);
      setIntervalMs(cachedIntervalMs);
      setLoading(false);
      return;
    }

    if (cachedSlides) {
      setSlides(cachedSlides);
      setIntervalMs(cachedIntervalMs);
      setLoading(false);
    } else {
      setLoading(true);
    }

    fetch(`${API_URL}/banners`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        const { slides: list, intervalMs: interval } = normalizeBanners(data);
        cachedSlides = list;
        cachedIntervalMs = interval;
        cacheTime = Date.now();
        setSlides(list);
        setIntervalMs(interval);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pathname]);

  if (pathname !== '/') return null;
  if (loading && slides.length === 0) return <BannerSkeleton />;
  return <BannerCarousel slides={slides} intervalMs={intervalMs} />;
}
