'use client';

import { useState, memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { ShoppingCart, Check, Eye, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FavoriteButton } from '@/app/product/[id]/favorite-button';
import { ProductShareBtn } from '@/components/product/product-share-btn';
import { ProductQuickView } from '@/components/product/product-quick-view';
import { API_URL, formatPrice } from '@/lib/utils';
import { getCartHeaders, saveCartSessionFromResponse } from '@/lib/cart-session';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface ProductCardProduct {
  id: string;
  title: string;
  slug: string;
  price: string;
  comparePrice?: string | null;
  stock?: number;
  unit?: string | null;
  images: { url: string }[];
  shop?: { name?: string; slug: string };
  createdAt?: string;
  /** Если есть — при клике «Savatchaga» откроется быстрый просмотр с модалом выбора варианта */
  options?: Record<string, string[]> | null;
  /** Средний рейтинг 1–5 (с сервера) */
  avgRating?: number | null;
  /** Количество отзывов */
  reviewsCount?: number;
}

interface ProductCardProps {
  product: ProductCardProduct;
  className?: string;
  /** When true, heart is shown as filled (e.g. on favorites page) */
  initialFavorite?: boolean;
  /** Called when favorite state changes (e.g. to remove from favorites page list) */
  onFavoriteChange?: (inFavorites: boolean) => void;
  /** Set for above-the-fold images (e.g. first cards on home) to fix LCP */
  priority?: boolean;
}

const NEW_DAYS = 7;

function ProductCardInner({ product, className, initialFavorite, onFavoriteChange, priority }: ProductCardProps) {
  const [added, setAdded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showQuickView, setShowQuickView] = useState(false);
  const [openVariantModalWhenReady, setOpenVariantModalWhenReady] = useState(false);
  const hasOptions = product.options != null && Object.keys(product.options).length > 0;
  const price = Number(product.price);
  const comparePrice = product.comparePrice != null ? Number(product.comparePrice) : null;
  const discountPercent =
    comparePrice != null && comparePrice > price ? Math.round((1 - price / comparePrice) * 100) : null;
  const outOfStock = (product.stock ?? 0) <= 0;
  const isNew =
    product.createdAt &&
    Date.now() - new Date(product.createdAt).getTime() < NEW_DAYS * 24 * 60 * 60 * 1000;
  const priceStr = formatPrice(price);

  const addToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock || loading) return;
    if (hasOptions) {
      setOpenVariantModalWhenReady(true);
      setShowQuickView(true);
      return;
    }
    setLoading(true);
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
          toast.success('Savatchaga qoʻshildi');
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cart-updated'));
        } else {
          toast.error('Qoʻshishda xatolik');
        }
      })
      .catch(() => toast.error('Savatchaga qoʻshib boʻlmadi'))
      .finally(() => setLoading(false));
  };

  return (
    <div
      className={cn(
        'group relative bg-card rounded-3xl shadow-sm md:hover:shadow-md transition-[box-shadow] duration-200 overflow-hidden flex flex-col h-full border border-border',
        className
      )}
    >
      <Link href={`/product/${product.id}`} className="flex flex-col flex-1 min-h-0">
        {/* Бейджи — адаптивный размер: меньше на мобильном, больше на десктопе */}
        <div className="absolute top-1.5 left-1.5 md:top-3 md:left-3 z-10 flex flex-col gap-1 md:gap-1.5 pointer-events-none">
          {isNew && (
            <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-0 text-[10px] px-1.5 py-0 h-5 md:text-xs md:px-2 md:py-1 md:h-6 md:min-h-6">
              Yangilik
            </Badge>
          )}
          {discountPercent != null && discountPercent > 0 && (
            <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-[10px] px-1.5 py-0 h-5 font-medium md:text-xs md:px-2 md:py-1 md:h-6 md:min-h-6">
              Aksiya -{discountPercent}%
            </Badge>
          )}
          {outOfStock && (
            <Badge variant="secondary" className="bg-muted-foreground/80 text-muted hover:bg-muted-foreground/80 text-[10px] px-1.5 py-0 h-5 md:text-xs md:px-2 md:py-1 md:h-6 md:min-h-6">
              Mavjud emas
            </Badge>
          )}
        </div>

        {/* Кнопки справа — без blur на мобильном (ускоряет скролл) */}
        <div className="absolute top-1.5 right-1.5 md:top-2 md:right-2 z-10 flex items-center gap-1 md:gap-1.5" onClick={(e) => e.stopPropagation()}>
          <ProductShareBtn
            productId={product.id}
            productName={product.title}
            className="h-8 w-8 md:h-10 md:w-10 rounded-full shadow-md bg-card border border-border text-muted-foreground hover:text-foreground md:bg-background/90 md:backdrop-blur-sm"
            iconClassName="h-3.5 w-3.5 md:h-5 md:w-5"
          />
          <FavoriteButton
            productId={product.id}
            initial={initialFavorite}
            className="h-8 w-8 md:h-10 md:w-10 rounded-full shadow-md bg-card border border-border md:bg-background/90 md:backdrop-blur-sm"
            iconClassName="h-3.5 w-3.5 md:h-5 md:w-5"
            activeClassName="bg-red-50 hover:bg-red-100 text-red-500"
            onToggle={onFavoriteChange}
          />
        </div>

        {/* Блок изображения + overlay при наведении (как Quick view в примере) */}
        <div className="aspect-[4/5] relative bg-muted overflow-hidden">
          {product.images?.[0] ? (
            <Image
              src={product.images[0].url}
              alt={product.title}
              fill
              className="object-cover md:group-hover:scale-105 md:transition-transform md:duration-300"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
              priority={priority}
              loading={priority ? undefined : 'lazy'}
              decoding="async"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <span className="text-sm">Rasm yoʻq</span>
            </div>
          )}

          {/* Overlay «Tezkor koʻrish» — только десктоп (на мобильном не показываем, меньше работы при скролле) */}
          <div className="absolute inset-x-4 bottom-4 z-20 hidden md:flex justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 translate-y-2 group-hover:translate-y-0 pointer-events-none">
            <Button
              size="sm"
              variant="secondary"
              className="pointer-events-auto shadow-lg bg-card hover:bg-card border border-border w-full h-9 gap-2 text-xs font-medium"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowQuickView(true);
              }}
            >
              <Eye className="h-4 w-4" />
              Tezkor koʻrish
            </Button>
          </div>
        </div>

        {/* Контент под фото — порядок как в примере */}
        <div className="p-3 flex flex-col flex-1 gap-0">
          {/* Старая цена и текущая цена */}
          <div className="flex flex-col">
            {comparePrice != null && comparePrice > price && (
              <span className="text-sm text-muted-foreground line-through leading-tight">
                {formatPrice(comparePrice)} soʻm{product.unit ? ` / ${product.unit}` : ''}
              </span>
            )}
            <div className="flex items-baseline gap-2 overflow-hidden">
              <span
                className={cn(
                  'font-bold text-primary truncate leading-tight',
                  priceStr.length > 12 ? 'text-base' : 'text-lg'
                )}
              >
                {priceStr} soʻm{product.unit ? ` / ${product.unit}` : ''}
              </span>
            </div>
          </div>

          {/* Название */}
          <h3
            className="font-medium text-xs sm:text-sm truncate group-hover:text-primary transition-colors leading-tight -mt-0.5"
            title={product.title}
          >
            {product.title}
          </h3>

          {/* Сотувчи */}
          <div className="text-[10px] sm:text-xs text-muted-foreground truncate">
            {product.shop?.name ?? 'Doʻkon'}
          </div>

          {/* Рейтинг */}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {(product.reviewsCount ?? 0) > 0 && product.avgRating != null ? (
              <>
                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400 shrink-0" />
                <span className="font-medium text-foreground">{product.avgRating}</span>
                <span>·</span>
                <span>{product.reviewsCount} ta sharh</span>
              </>
            ) : (
              <span>Sharhlar yoʻq</span>
            )}
          </div>
        </div>
      </Link>

      {/* Кнопка «В корзину» — как в примере (без rounded-xl) */}
      <div className="p-3 pt-0 shrink-0">
        <Button
          variant="default"
          className="h-10 text-sm w-full font-semibold shadow-sm hover:shadow-md transition-all"
          onClick={addToCart}
          disabled={outOfStock || loading}
        >
          {added ? (
            <>
              <Check className="h-4 w-4" />
              Qoʻshildi
            </>
          ) : loading ? (
            'Qoʻshilmoqda...'
          ) : outOfStock ? (
            'Mavjud emas'
          ) : (
            <>
              <ShoppingCart className="h-4 w-4" />
              Savatchaga
            </>
          )}
        </Button>
      </div>

      {showQuickView && (
        <ProductQuickView
          open={showQuickView}
          onOpenChange={(open) => {
            setShowQuickView(open);
            if (!open) setOpenVariantModalWhenReady(false);
          }}
          productId={product.id}
          openVariantModalWhenReady={openVariantModalWhenReady}
          onVariantModalOpened={() => setOpenVariantModalWhenReady(false)}
        />
      )}
    </div>
  );
}

export const ProductCard = memo(ProductCardInner);
