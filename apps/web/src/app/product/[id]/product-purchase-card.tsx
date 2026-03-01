'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AddToCartButton } from './add-to-cart-button';
import { FavoriteButton } from './favorite-button';
import { ProductShareBtn } from '@/components/product/product-share-btn';
import { ProductTrustBadges } from './product-trust-badges';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/utils';

interface ProductPurchaseCardProps {
  productId: string;
  productTitle: string;
  price: number;
  comparePrice: number | null;
  stock: number;
  /** Не показывать блок цены (уже выведен снаружи, как в примере) */
  compact?: boolean;
}

export function ProductPurchaseCard({ productId, productTitle, price, comparePrice, stock, compact }: ProductPurchaseCardProps) {
  const [added, setAdded] = useState(false);

  const discountPercent =
    comparePrice != null && comparePrice > price
      ? Math.round((1 - price / comparePrice) * 100)
      : null;

  return (
    <div className={compact ? undefined : 'rounded-xl border border-border bg-card p-5 shadow-md md:sticky md:top-24 md:self-start'}>
      {!compact && (
        <>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {formatPrice(price)} soʻm
            </span>
            {comparePrice != null && comparePrice > price && (
              <>
                <span className="text-xl text-muted-foreground line-through">
                  {formatPrice(comparePrice)}
                </span>
                {discountPercent != null && (
                  <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-xs font-semibold text-destructive">
                    −{discountPercent}%
                  </span>
                )}
              </>
            )}
          </div>
        </>
      )}

      {stock > 0 && stock <= 10 && (
        <p className="text-amber-600 dark:text-amber-500 text-sm mt-1 font-medium">
          Omborda oz qoldi — {stock} dona
        </p>
      )}
      {stock > 10 && (
        <p className="text-muted-foreground text-sm mt-1">Omborda: {stock} dona</p>
      )}
      {stock === 0 && (
        <p className="text-destructive text-sm mt-1 font-medium">Hozircha mavjud emas</p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        <AddToCartButton
          productId={productId}
          maxQuantity={stock}
          onAdded={() => setAdded(true)}
        />
        <div className="flex gap-2">
          {stock > 0 ? (
            <Button asChild className="flex-1 gap-2" size="lg">
              <Link href="/cart">
                <ShoppingCart className="h-4 w-4" />
                {added ? 'Savatchaga oʻtish' : 'Xarid qilish'}
              </Link>
            </Button>
          ) : (
            <Button className="flex-1 gap-2" size="lg" disabled>
              Mavjud emas
            </Button>
          )}
          <FavoriteButton productId={productId} />
          <ProductShareBtn productId={productId} productName={productTitle} />
        </div>
      </div>

      {!compact && <ProductTrustBadges />}
    </div>
  );
}
