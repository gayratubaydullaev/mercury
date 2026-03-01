'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/utils';
import { BannerCarousel, type BannerSlide } from './banner-carousel';
import { cn } from '@/lib/utils';

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

export function BannerCarouselWrapper() {
  const pathname = usePathname();
  const [slides, setSlides] = useState<BannerSlide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (pathname !== '/') {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${API_URL}/banners`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then((data: { image: string; href: string; external?: boolean; title?: string | null }[]) => {
        const list = Array.isArray(data) ? data : [];
        setSlides(list.map((b) => ({ image: b.image, href: b.href, external: b.external, title: b.title ?? undefined })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pathname]);

  if (pathname !== '/') return null;
  if (loading) return <BannerSkeleton />;
  return <BannerCarousel slides={slides} />;
}
