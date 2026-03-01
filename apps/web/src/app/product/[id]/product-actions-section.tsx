'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogClose, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ProductPageClient } from './product-page-client';
import { ProductVariants } from '@/components/product/product-variants';
import { useProductSelectionOptional } from './product-selection-context';
import { API_URL, formatPrice } from '@/lib/utils';
import { getCartHeaders, saveCartSessionFromResponse } from '@/lib/cart-session';
import { apiFetch } from '@/lib/api';
import { ShoppingCart, Loader2, X, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function ProductActionsSection({ isMobile = false }: { isMobile?: boolean }) {
  const router = useRouter();
  const ctx = useProductSelectionOptional();
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [pendingVariantAction, setPendingVariantAction] = useState<'cart' | 'buy' | null>(null);
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);
  const [buying, setBuying] = useState(false);

  const hasVariants = (ctx?.variantGroups.length ?? 0) > 0;

  const addToCart = useCallback(async () => {
    if (!ctx) return;
    if ((ctx.stock ?? 0) <= 0) return;
    setAdding(true);
    try {
      const res = await apiFetch(`${API_URL}/cart/items`, {
        method: 'POST',
        headers: getCartHeaders(),
        body: JSON.stringify({
          productId: ctx.product.id,
          quantity: 1,
          ...(ctx.variantId ? { variantId: ctx.variantId } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      saveCartSessionFromResponse(data);
      if (res.ok) {
        setDone(true);
        setTimeout(() => setDone(false), 3000);
        toast.success('Savatchaga qoʻshildi');
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cart-updated'));
        setVariantModalOpen(false);
        setPendingVariantAction(null);
      } else {
        toast.error('Qoʻshishda xatolik');
      }
    } catch {
      toast.error('Savatchaga qoʻshib boʻlmadi');
    } finally {
      setAdding(false);
    }
  }, [ctx?.product.id, ctx?.variantId, ctx?.stock]);

  const buyNow = useCallback(async () => {
    if (!ctx) return;
    if ((ctx.stock ?? 0) <= 0) return;
    setBuying(true);
    try {
      const res = await apiFetch(`${API_URL}/cart/items`, {
        method: 'POST',
        headers: getCartHeaders(),
        body: JSON.stringify({
          productId: ctx.product.id,
          quantity: 1,
          ...(ctx.variantId ? { variantId: ctx.variantId } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      saveCartSessionFromResponse(data);
      if (res.ok) {
        toast.success('Savatchaga qoʻshildi');
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cart-updated'));
        setVariantModalOpen(false);
        setPendingVariantAction(null);
        router.push('/checkout');
      } else {
        toast.error('Qoʻshishda xatolik');
      }
    } catch {
      toast.error('Savatchaga qoʻshib boʻlmadi');
    } finally {
      setBuying(false);
    }
  }, [ctx?.product.id, ctx?.variantId, ctx?.stock, router]);

  const openVariantModal = useCallback((action: 'cart' | 'buy') => {
    setPendingVariantAction(action);
    setVariantModalOpen(true);
  }, []);

  if (!ctx) return null;

  const buttons = (
    <ProductPageClient
      productId={ctx.product.id}
      stock={ctx.stock}
      variantId={ctx.variantId}
      hasVariants={hasVariants}
      isMobile={isMobile}
      onAddToCart={addToCart}
      onBuyNow={buyNow}
      onOpenVariantModal={hasVariants ? openVariantModal : undefined}
      adding={adding}
      done={done}
      buying={buying}
    />
  );

  return (
    <>
      {isMobile ? (
        <div className="fixed bottom-[calc(3rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 p-2 bg-card/95 backdrop-blur-sm rounded-t-xl border-t border-border shadow-lg">
          <div className="max-w-lg mx-auto px-2">{buttons}</div>
        </div>
      ) : (
        buttons
      )}

      <Dialog open={variantModalOpen} onOpenChange={(open) => { setVariantModalOpen(open); if (!open) setPendingVariantAction(null); }}>
        <DialogContent
          showClose={false}
          className="max-w-4xl w-full p-0 gap-0 overflow-hidden md:rounded-2xl rounded-t-2xl rounded-b-none md:h-[600px] h-[90vh] flex flex-col [&>button:last-child]:hidden"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">Variantni tanlang</DialogTitle>
          <DialogDescription className="sr-only">Mahsulot varianti va narx</DialogDescription>
          <DialogClose
            aria-label="Yopish"
            className="absolute top-4 right-4 z-[60] rounded-full bg-card/80 p-2 hover:bg-card transition-colors h-10 w-10 flex items-center justify-center border border-border shadow-sm backdrop-blur-sm outline-none focus:ring-0"
          >
            <X className="h-5 w-5" />
          </DialogClose>

          <div className="flex flex-col md:flex-row h-full overflow-y-auto md:overflow-hidden">
            {/* Галерея — слева, как у карточек */}
            <div className="w-full md:w-1/2 bg-muted/50 md:p-6 md:h-full md:overflow-y-auto shrink-0">
              <div className="relative aspect-square md:aspect-[3/4] rounded-2xl overflow-hidden bg-muted">
                {(ctx.currentVariant?.imageUrl ?? ctx.product.images?.[0]?.url) ? (
                  <Image
                    src={ctx.currentVariant?.imageUrl ?? ctx.product.images?.[0]?.url ?? ''}
                    alt={ctx.product.title ?? ''}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    Rasm yoʻq
                  </div>
                )}
              </div>
            </div>

            {/* Инфо — справа */}
            <div className="w-full md:w-1/2 flex flex-col md:h-full md:overflow-y-auto bg-card">
              <div className="flex-1 space-y-6 p-4 md:p-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-foreground leading-tight">
                    {ctx.product.title ?? ''}
                  </h2>
                  <div className="flex items-center gap-2 mt-2 text-sm">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium text-foreground">{ctx.product.avgRating ?? '—'}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">
                      {(ctx.product.reviewsCount ?? 0) > 0 ? `${ctx.product.reviewsCount} ta sharh` : 'Sharhlar yoʻq'}
                    </span>
                  </div>
                </div>

                {(() => {
                  const basePrice = ctx.product.price != null ? Number(ctx.product.price) : 0;
                  const variantPrice = ctx.currentVariant?.priceOverride != null ? Number(ctx.currentVariant.priceOverride) : null;
                  const price = variantPrice ?? basePrice;
                  const comparePriceRaw = ctx.product.comparePrice != null ? Number(ctx.product.comparePrice) : null;
                  const comparePrice = variantPrice != null ? comparePriceRaw : comparePriceRaw;
                  const discountPercent =
                    comparePrice != null && comparePrice > price
                      ? Math.round((1 - price / comparePrice) * 100)
                      : null;
                  return (
                    <div className="flex items-end gap-2 flex-wrap">
                      <span className="text-2xl font-bold text-foreground tracking-tight">
                        {formatPrice(price)} soʻm
                      </span>
                      {discountPercent != null && discountPercent > 0 && (
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-base text-muted-foreground line-through decoration-red-400 decoration-2">
                            {formatPrice(comparePrice ?? price)} soʻm
                          </span>
                          <Badge variant="destructive" className="bg-red-100 text-red-600 hover:bg-red-200 border-red-200 text-[10px] px-1.5 h-4">
                            -{discountPercent}%
                          </Badge>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Variantni tanlang</h3>
                  <ProductVariants
                    variants={ctx.variantGroups}
                    selected={ctx.selected}
                    onChange={ctx.handleVariantChange}
                  />
                </div>

                {ctx.product.shop && (
                  <p className="text-sm text-muted-foreground">
                    Doʻkon: <span className="font-medium text-foreground">{ctx.product.shop.name ?? ctx.product.shop.slug}</span>
                  </p>
                )}
              </div>

              <div className="pt-4 bg-card sticky bottom-0 z-10 border-t border-border mt-auto p-4 md:p-6 md:pt-0 pb-safe space-y-3">
                <Button
                  onClick={addToCart}
                  disabled={!ctx.variantId || (ctx.stock ?? 0) <= 0 || adding}
                  className="h-11 w-full text-base font-semibold gap-1.5 shadow-sm hover:shadow-md transition-all"
                >
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                  Savatchaga
                </Button>
                <Button
                  onClick={buyNow}
                  disabled={!ctx.variantId || (ctx.stock ?? 0) <= 0 || buying}
                  className="h-11 w-full text-base font-semibold gap-1.5 bg-blue-600 hover:bg-blue-700"
                >
                  {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Xarid qilish'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
