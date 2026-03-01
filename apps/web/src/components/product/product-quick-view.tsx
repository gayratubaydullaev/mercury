'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogClose, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProductOptions } from '@/app/product/[id]/product-options';
import { API_URL, formatPrice } from '@/lib/utils';
import { getCartHeaders, saveCartSessionFromResponse } from '@/lib/cart-session';
import { apiFetch } from '@/lib/api';
import { X, ExternalLink, ShoppingCart, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickViewProduct {
  id: string;
  title: string;
  price: string;
  comparePrice?: string | null;
  stock?: number;
  images: { url: string; alt?: string | null }[];
  shop?: { name?: string; slug: string };
  options?: Record<string, string[]> | null;
  avgRating?: number | null;
  reviewsCount?: number;
}

interface ProductQuickViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  /** Открыть модал выбора варианта сразу после загрузки (например, с карточки по кнопке «Savatchaga») */
  openVariantModalWhenReady?: boolean;
  onVariantModalOpened?: () => void;
}

export function ProductQuickView({ open, onOpenChange, productId, openVariantModalWhenReady, onVariantModalOpened }: ProductQuickViewProps) {
  const [product, setProduct] = useState<QuickViewProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const quickViewScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && productId) {
      setLoading(true);
      setAdded(false);
      apiFetch(`${API_URL}/products/${productId}`)
        .then((r) => r.json())
        .then(setProduct)
        .catch(() => setProduct(null))
        .finally(() => setLoading(false));
    } else {
      setProduct(null);
      setVariantModalOpen(false);
      setImageIndex(0);
    }
  }, [open, productId]);

  const images = product?.images ?? [];
  const hasMultipleImages = images.length > 1;
  const prevImage = () => {
    const next = imageIndex <= 0 ? images.length - 1 : imageIndex - 1;
    setImageIndex(next);
    const w = quickViewScrollRef.current?.clientWidth ?? 0;
    quickViewScrollRef.current?.scrollTo({ left: next * w, behavior: 'smooth' });
  };
  const nextImage = () => {
    const next = imageIndex >= images.length - 1 ? 0 : imageIndex + 1;
    setImageIndex(next);
    const w = quickViewScrollRef.current?.clientWidth ?? 0;
    quickViewScrollRef.current?.scrollTo({ left: next * w, behavior: 'smooth' });
  };
  const handleQuickViewScroll = () => {
    const el = quickViewScrollRef.current;
    if (!el || images.length === 0) return;
    const w = el.clientWidth;
    const idx = Math.round(el.scrollLeft / w);
    setImageIndex(Math.min(idx, images.length - 1));
  };

  const price = product ? Number(product.price) : 0;
  const comparePrice = product?.comparePrice != null ? Number(product.comparePrice) : null;
  const discountPercent =
    comparePrice != null && comparePrice > price
      ? Math.round((1 - price / comparePrice) * 100)
      : null;
  const stock = product?.stock ?? 0;
  const hasOptions = product?.options != null && Object.keys(product.options).length > 0;

  // Когда открыли из кнопки «Savatchaga» для товара с вариантами — показываем только Quick View
  // (в нём уже есть выбор вариантов), не открываем второй модал.
  useEffect(() => {
    if (open && product && hasOptions && openVariantModalWhenReady) {
      onVariantModalOpened?.();
    }
  }, [open, product, hasOptions, openVariantModalWhenReady, onVariantModalOpened]);

  const handleAddToCartClick = () => {
    if (hasOptions) {
      setVariantModalOpen(true);
    } else {
      doAddToCart();
    }
  };

  const doAddToCart = () => {
    if (!product) return;
    setAdding(true);
    apiFetch(`${API_URL}/cart/items`, {
      method: 'POST',
      headers: getCartHeaders(),
      body: JSON.stringify({ productId: String(product.id), quantity: 1 }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        saveCartSessionFromResponse(data);
        if (r.ok) {
          setAdded(true);
          setVariantModalOpen(false);
          toast.success('Savatchaga qoʻshildi');
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cart-updated'));
        } else {
          toast.error('Qoʻshishda xatolik');
        }
      })
      .catch(() => toast.error('Savatchaga qoʻshib boʻlmadi'))
      .finally(() => setAdding(false));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showClose={false}
          className="max-w-4xl w-full p-0 gap-0 overflow-hidden md:rounded-2xl rounded-t-2xl rounded-b-none md:h-[600px] h-[90vh] flex flex-col [&>button:last-child]:hidden"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">Tezkor koʻrish: {product?.title ?? 'Mahsulot'}</DialogTitle>
          <DialogDescription className="sr-only">Mahsulot rasmlari va maʼlumotlari</DialogDescription>
          <DialogClose className="absolute top-4 right-4 z-[60] rounded-full bg-card/80 p-2 hover:bg-card transition-colors h-10 w-10 flex items-center justify-center border border-border shadow-sm backdrop-blur-sm outline-none focus:ring-0">
            <X className="h-5 w-5" />
            <span className="sr-only">Yopish</span>
          </DialogClose>

          {loading || !product ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="flex flex-col md:flex-row h-full overflow-y-auto md:overflow-hidden">
              {/* Галерея — слева, прокрутка фото (стрелки + свайп/скролл) */}
              <div className="w-full md:w-1/2 bg-muted/50 md:p-6 md:h-full md:overflow-y-auto shrink-0">
                <div className="relative aspect-square md:aspect-[3/4] rounded-2xl overflow-hidden bg-muted">
                  {images.length > 0 ? (
                    <>
                      <div
                        ref={quickViewScrollRef}
                        onScroll={handleQuickViewScroll}
                        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide h-full w-full touch-pan-x touch-manipulation"
                        style={{ scrollSnapType: 'x mandatory' }}
                      >
                        {images.map((img, idx) => (
                          <div
                            key={idx}
                            className="w-full h-full flex-shrink-0 snap-center relative"
                            style={{ scrollSnapAlign: 'center' }}
                          >
                            <Image
                              src={img.url}
                              alt={img.alt ?? `${product.title} ${idx + 1}`}
                              fill
                              className="object-contain"
                              sizes="(max-width: 768px) 100vw, 50vw"
                            />
                          </div>
                        ))}
                      </div>
                      {hasMultipleImages && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              prevImage();
                            }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-card/90 backdrop-blur-sm shadow-md flex items-center justify-center hover:bg-card border border-border z-10"
                            aria-label="Oldingi rasm"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              nextImage();
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-card/90 backdrop-blur-sm shadow-md flex items-center justify-center hover:bg-card border border-border z-10"
                            aria-label="Keyingi rasm"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                            {images.map((_, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setImageIndex(i);
                                  quickViewScrollRef.current?.scrollTo({
                                    left: i * (quickViewScrollRef.current?.clientWidth ?? 0),
                                    behavior: 'smooth',
                                  });
                                }}
                                className={cn(
                                  'h-1.5 rounded-full transition-all',
                                  i === imageIndex ? 'bg-primary w-4' : 'bg-primary/50 w-1.5'
                                )}
                                aria-label={`Rasm ${i + 1}`}
                              />
                            ))}
                          </div>
                          <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-md z-10">
                            {imageIndex + 1} / {images.length}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                      Rasm yoʻq
                    </div>
                  )}
                </div>
              </div>

              {/* Инфо — справа, белый фон как в примере */}
              <div className="w-full md:w-1/2 flex flex-col md:h-full md:overflow-y-auto bg-card">
                <div className="flex-1 space-y-6 p-4 md:p-6">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-foreground leading-tight">
                      {product.title}
                    </h2>
                    <div className="flex items-center gap-2 mt-2 text-sm">
                      <div className="flex items-center gap-1 text-yellow-600 font-bold">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span>{product.avgRating ?? '—'}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {(product.reviewsCount ?? 0) > 0 ? `${product.reviewsCount} ta sharh` : 'Sharhlar yoʻq'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-end gap-2 flex-wrap">
                    <span className="text-2xl font-bold text-foreground tracking-tight">
                      {formatPrice(price)} soʻm
                    </span>
                    {discountPercent != null && discountPercent > 0 && (
                      <div className="mb-1 flex items-center gap-2 flex-wrap">
                        <span className="text-base text-muted-foreground line-through decoration-red-400 decoration-2">
                          {formatPrice(comparePrice ?? price)} soʻm
                        </span>
                        <Badge className="bg-amber-500 text-white border-0 text-[10px] px-1.5 h-4 font-medium">
                          Aksiya -{discountPercent}%
                        </Badge>
                      </div>
                    )}
                  </div>

                  {hasOptions && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Variantni tanlang</h3>
                      <ProductOptions options={product.options ?? {}} />
                    </div>
                  )}

                  {product.shop && (
                    <p className="text-sm text-muted-foreground">
                      Doʻkon: <span className="font-medium text-foreground">{product.shop.name ?? product.shop.slug}</span>
                    </p>
                  )}
                </div>

                {/* Футер с кнопками — как в примере */}
                <div className="pt-4 bg-card sticky bottom-0 z-10 border-t border-border mt-auto p-4 md:p-6 md:pt-0 pb-safe space-y-3">
                  <Button
                    onClick={handleAddToCartClick}
                    disabled={stock <= 0 || adding}
                    className="h-11 w-full text-base font-semibold gap-1.5 shadow-sm hover:shadow-md transition-all"
                  >
                    {added ? (
                      <>Qoʻshildi</>
                    ) : adding ? (
                      'Qoʻshilmoqda...'
                    ) : stock <= 0 ? (
                      'Mavjud emas'
                    ) : (
                      <>
                        <ShoppingCart className="h-4 w-4" />
                        Savatchaga
                      </>
                    )}
                  </Button>
                  <Button asChild variant="outline" className="w-full gap-2 h-11" size="sm">
                    <Link href={`/product/${product.id}`} onClick={() => onOpenChange(false)}>
                      <ExternalLink className="h-4 w-4" />
                      Toʻliq maʼlumot
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Модал выбора варианта — когда у товара есть варианты */}
      <Dialog open={variantModalOpen} onOpenChange={setVariantModalOpen}>
        <DialogContent className="sm:max-w-md w-[90%] rounded-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Variantni tanlang</DialogTitle>
            <DialogDescription className="sr-only">Mahsulot variantini tanlang va savatchaga qoʻshing</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {product?.options && <ProductOptions options={product.options} />}
          </div>
          <DialogFooter>
            <Button
              onClick={doAddToCart}
              disabled={adding}
              className="w-full h-12 text-base gap-2"
            >
              {adding ? 'Qoʻshilmoqda...' : (
                <>
                  <ShoppingCart className="h-4 w-4" />
                  Savatchaga qoʻshish
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
