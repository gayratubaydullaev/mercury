'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImageLightbox } from '@/components/product/image-lightbox';

interface ProductGalleryProps {
  images: { url: string; alt?: string | null }[];
  title: string;
}

export function ProductGallery({ images, title }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const mainUrl = images[selectedIndex]?.url ?? images[0]?.url;
  const prev = () => setSelectedIndex((i) => (i <= 0 ? images.length - 1 : i - 1));
  const next = () => setSelectedIndex((i) => (i >= images.length - 1 ? 0 : i + 1));

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      if (dx > 0) prev();
      else next();
    }
    touchStartX.current = null;
  };

  if (!images?.length) {
    return (
      <div className="aspect-square md:aspect-[3/4] rounded-2xl overflow-hidden bg-muted flex items-center justify-center text-muted-foreground">
        Rasm yoʻq
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid gap-2 h-full',
        images.length > 1 ? 'grid-cols-1 md:grid-cols-[100px_1fr]' : 'grid-cols-1'
      )}
    >
      {/* Вертикальные миниатюры — desktop */}
      {images.length > 1 && (
        <div className="hidden md:block relative h-full min-h-0">
          <div className="absolute inset-0 overflow-y-auto scrollbar-thin flex flex-col gap-2">
            {images.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIndex(i);
                }}
                className={cn(
                  'relative w-full aspect-[3/4] rounded-lg overflow-hidden bg-card border border-border shrink-0 transition-all',
                  selectedIndex === i
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-transparent hover:border-border'
                )}
              >
                <Image
                  src={img.url}
                  alt={img.alt ?? `${title} ${i + 1}`}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Основное изображение — на десктопе заполняет всю высоту колонки, без белой рамки */}
      <div
        className={cn(
          'relative group w-full min-h-0 md:h-full',
          images.length === 1 && 'max-w-lg mx-auto'
        )}
      >
        <div
          className="aspect-[3/4] md:aspect-auto md:h-full md:min-h-0 relative rounded-2xl overflow-hidden bg-muted border border-border shadow-sm w-full cursor-zoom-in"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={() => setLightboxOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setLightboxOpen(true)}
          aria-label="Rasmini toʻliq ekranda ochish"
        >
          <Image
            src={mainUrl}
            alt={title}
            fill
            className="object-cover select-none touch-none"
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            draggable={false}
          />

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm shadow-md flex items-center justify-center opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-card border border-border"
                aria-label="Oldingi"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm shadow-md flex items-center justify-center opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-card border border-border"
                aria-label="Keyingi"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 md:hidden pointer-events-none">
                {images.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-1.5 rounded-full transition-all bg-primary/80',
                      i === selectedIndex ? 'w-4' : 'w-1.5 opacity-60'
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Миниатюры снизу — mobile */}
      {images.length > 1 && (
        <div className="flex md:hidden gap-2 overflow-x-auto pb-1 scrollbar-thin touch-pan-x touch-manipulation">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedIndex(i);
              }}
              className={cn(
                'relative w-20 aspect-[3/4] shrink-0 rounded-lg overflow-hidden border-2 transition-all',
                selectedIndex === i
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-transparent'
              )}
            >
              <Image
                src={img.url}
                alt={img.alt ?? `${title} ${i + 1}`}
                fill
                className="object-cover"
                sizes="80px"
              />
            </button>
          ))}
        </div>
      )}

      <ImageLightbox
        images={images}
        initialIndex={selectedIndex}
        title={title}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
