'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { ImageLightbox } from '@/components/product/image-lightbox';

interface MobileProductGalleryProps {
  images: { url: string; alt?: string | null }[];
  productName: string;
}

export function MobileProductGallery({ images, productName }: MobileProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const urls = images?.map((img) => img.url) ?? [];
  const alt = (i: number) => images?.[i]?.alt ?? `${productName} ${i + 1}`;

  if (!urls.length) {
    return (
      <div className="aspect-[3/4] relative bg-muted flex items-center justify-center">
        <span className="text-muted-foreground">Rasm yoʻq</span>
      </div>
    );
  }

  const handleScroll = () => {
    if (scrollRef.current) {
      const scrollLeft = scrollRef.current.scrollLeft;
      const width = scrollRef.current.clientWidth;
      const index = Math.round(scrollLeft / width);
      setActiveIndex(index);
    }
  };

  return (
    <div className="relative w-full">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onClick={() => setLightboxOpen(true)}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide aspect-[3/4] cursor-zoom-in touch-manipulation touch-pan-x"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setLightboxOpen(true)}
        aria-label="Rasmini toʻliq ekranda ochish"
      >
        {urls.map((url, idx) => (
          <div key={idx} className="w-full flex-shrink-0 snap-center relative bg-card">
            <Image
              src={url}
              alt={alt(idx)}
              fill
              className="object-contain"
              sizes="100vw"
              priority={idx === 0}
            />
          </div>
        ))}
      </div>

      {urls.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {urls.map((_, idx) => (
            <div
              key={idx}
              className={cn(
                'h-1.5 rounded-full transition-all shadow-sm',
                activeIndex === idx ? 'bg-primary w-3' : 'bg-primary/50 w-1.5'
              )}
            />
          ))}
        </div>
      )}

      <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-md z-10">
        {activeIndex + 1} / {urls.length}
      </div>

      <ImageLightbox
        images={images}
        initialIndex={activeIndex}
        title={productName}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
