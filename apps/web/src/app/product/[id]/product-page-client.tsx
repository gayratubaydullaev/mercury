'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { API_URL } from '@/lib/utils';
import { getCartHeaders, saveCartSessionFromResponse } from '@/lib/cart-session';
import { apiFetch } from '@/lib/api';
import { ShoppingCart, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ProductPageClient({
  productId,
  stock,
  variantId,
  hasVariants = false,
  isMobile = false,
  onAddToCart: onAddToCartProp,
  onBuyNow: onBuyNowProp,
  onOpenVariantModal,
  adding: addingProp,
  done: doneProp,
  buying: buyingProp,
}: {
  productId: string;
  stock: number;
  variantId?: string;
  hasVariants?: boolean;
  isMobile?: boolean;
  onAddToCart?: () => void | Promise<void>;
  onBuyNow?: () => void | Promise<void>;
  onOpenVariantModal?: (action: 'cart' | 'buy') => void;
  adding?: boolean;
  done?: boolean;
  buying?: boolean;
}) {
  const router = useRouter();
  const [addingLocal, setAddingLocal] = useState(false);
  const [doneLocal, setDoneLocal] = useState(false);
  const [buyingLocal, setBuyingLocal] = useState(false);

  const useControlled = onAddToCartProp != null;
  const adding = useControlled ? (addingProp ?? false) : addingLocal;
  const done = useControlled ? (doneProp ?? false) : doneLocal;
  const buying = useControlled ? (buyingProp ?? false) : buyingLocal;

  const needVariant = hasVariants && variantId == null;
  const disabled = !needVariant && stock <= 0;

  const addToCartInternal = async () => {
    if (stock <= 0) return;
    setAddingLocal(true);
    try {
      const res = await apiFetch(`${API_URL}/cart/items`, {
        method: 'POST',
        headers: getCartHeaders(),
        body: JSON.stringify({ productId, quantity: 1, ...(variantId ? { variantId } : {}) }),
      });
      const data = await res.json().catch(() => null);
      saveCartSessionFromResponse(data);
      if (res.ok) {
        setDoneLocal(true);
        setTimeout(() => setDoneLocal(false), 3000);
        toast.success('Savatchaga qoʻshildi');
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cart-updated'));
      } else toast.error('Qoʻshishda xatolik');
    } catch {
      toast.error('Savatchaga qoʻshib boʻlmadi');
    } finally {
      setAddingLocal(false);
    }
  };

  const buyNowInternal = async () => {
    if (stock <= 0) return;
    setBuyingLocal(true);
    try {
      const res = await apiFetch(`${API_URL}/cart/items`, {
        method: 'POST',
        headers: getCartHeaders(),
        body: JSON.stringify({ productId, quantity: 1, ...(variantId ? { variantId } : {}) }),
      });
      const data = await res.json().catch(() => null);
      saveCartSessionFromResponse(data);
      if (res.ok) {
        toast.success('Savatchaga qoʻshildi');
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cart-updated'));
        router.push('/checkout');
      } else toast.error('Qoʻshishda xatolik');
    } catch {
      toast.error('Savatchaga qoʻshib boʻlmadi');
    } finally {
      setBuyingLocal(false);
    }
  };

  const handleAddToCart = () => {
    if (needVariant && onOpenVariantModal) {
      onOpenVariantModal('cart');
      return;
    }
    if (onAddToCartProp) onAddToCartProp();
    else addToCartInternal();
  };

  const handleBuyNow = () => {
    if (needVariant && onOpenVariantModal) {
      onOpenVariantModal('buy');
      return;
    }
    if (onBuyNowProp) onBuyNowProp();
    else buyNowInternal();
  };

  if (isMobile) {
    return (
      <div className="flex gap-2 w-full">
        <Button
          onClick={handleAddToCart}
          disabled={disabled || adding || done}
          className={cn(
            'h-11 flex-1 text-sm font-semibold gap-1.5 shadow-sm px-2',
            done ? 'bg-green-600 hover:bg-green-700' : 'bg-primary'
          )}
        >
          {done ? (
            <>
              <Check className="h-4 w-4 shrink-0" />
              <span className="truncate">Qoʻshildi</span>
            </>
          ) : adding ? (
            <span className="truncate">Qoʻshilmoqda...</span>
          ) : (
            <>
              <ShoppingCart className="h-4 w-4 shrink-0" />
              <span className="truncate">Savatchaga</span>
            </>
          )}
        </Button>
        <Button
          onClick={handleBuyNow}
          disabled={disabled || buying}
          className="h-11 flex-1 text-sm font-semibold gap-1.5 shadow-sm bg-blue-600 hover:bg-blue-700 text-white px-2"
        >
          {buying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <span className="truncate">Xarid qilish</span>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <Button
        onClick={handleAddToCart}
        disabled={disabled || adding || done}
        className={cn(
          'h-11 w-full text-base font-semibold gap-1.5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0',
          done ? 'bg-green-600 hover:bg-green-700' : 'bg-primary hover:bg-primary/90'
        )}
        size="sm"
      >
        {done ? (
          <>
            <Check className="h-4 w-4" />
            Qoʻshildi
          </>
        ) : adding ? (
          'Qoʻshilmoqda...'
        ) : (
          <>
            <ShoppingCart className="h-4 w-4" />
            Savatchaga
          </>
        )}
      </Button>
      <Button
        onClick={handleBuyNow}
        disabled={disabled || buying}
        className="h-11 w-full text-base font-semibold gap-1.5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 bg-blue-600 hover:bg-blue-700 text-white"
        size="sm"
      >
        {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Xarid qilish'}
      </Button>
    </div>
  );
}
