'use client';

import Link from 'next/link';
import Image from 'next/image';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Minus, Plus } from 'lucide-react';
import { API_URL, formatPrice } from '@/lib/utils';
import { getCartHeaders, saveCartSessionFromResponse } from '@/lib/cart-session';
import { apiFetch } from '@/lib/api';

interface CartItem {
  id: string;
  quantity: number;
  productId?: string;
  variantId?: string | null;
  product: { id: string; title: string; price: string; stock?: number; images: { url: string }[] };
  variant?: { stock: number } | null;
}

type CartData = { items: CartItem[]; sessionId?: string };

async function cartFetcher(): Promise<CartData | null> {
  const r = await apiFetch(`${API_URL}/cart`, { headers: getCartHeaders() });
  const data = await r.json();
  saveCartSessionFromResponse(data);
  return data;
}

export function CartContent() {
  const { data: cart, isLoading, mutate } = useSWR<CartData | null>('cart', cartFetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  });

  const updateQuantity = (productId: string, newQty: number, variantId?: string | null) => {
    if (!cart || newQty < 1) return;
    const url = variantId
      ? `${API_URL}/cart/items/${productId}?variantId=${encodeURIComponent(variantId)}`
      : `${API_URL}/cart/items/${productId}`;
    apiFetch(url, {
      method: 'PATCH',
      headers: getCartHeaders(),
      body: JSON.stringify({ quantity: newQty }),
    })
      .then((r) => r.json())
      .then((data) => {
        saveCartSessionFromResponse(data);
        mutate(data, false);
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cart-updated'));
      });
  };

  if (isLoading && cart == null) return <div className="animate-pulse h-32 bg-muted rounded-lg" />;
  if (!cart?.items?.length) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <p className="text-muted-foreground mb-4">Savatcha boʻsh</p>
        <Button asChild><Link href="/catalog">Katalogga oʻtish</Link></Button>
      </div>
    );
  }

  const total = cart.items.reduce((s, i) => s + Number(i.product.price) * i.quantity, 0);

  const getAvailableStock = (item: CartItem) => {
    if (item.variant != null) return item.variant.stock;
    return item.product.stock ?? 0;
  };

  const hasInvalidStock = cart.items.some((item) => {
    const available = getAvailableStock(item);
    return available <= 0 || item.quantity > available;
  });

  return (
    <div className="space-y-6">
      {hasInvalidStock && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
          <p className="font-medium">Baʼzi mahsulotlar tugagan yoki soʻralgan miqdorda mavjud emas. Savatni yangilang yoki buyurtma berishdan oldin miqdorni kamaytiring.</p>
        </div>
      )}
      <div className="space-y-3">
        {cart.items.map((item) => {
          const available = getAvailableStock(item);
          const outOfStock = available <= 0;
          const overRequested = item.quantity > available && available > 0;
          const stockWarning = outOfStock ? 'Mahsulot tugadi' : overRequested ? `Faqat ${available} ta mavjud` : null;
          return (
            <div key={item.id} className="flex gap-4 p-4 rounded-xl border bg-card">
              <Link href={`/product/${item.product.id}`} className="relative w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-muted block">
                {item.product.images?.[0] && <Image src={item.product.images[0].url} alt="" fill className="object-cover" sizes="96px" />}
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/product/${item.product.id}`} className="font-medium truncate block hover:text-primary hover:underline">
                  {item.product.title}
                </Link>
                <p className="text-sm text-muted-foreground mt-0.5">{formatPrice(Number(item.product.price))} soʻm</p>
                {stockWarning && (
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mt-1">{stockWarning}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center border rounded-lg overflow-hidden">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-none"
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.variantId)}
                      disabled={item.quantity <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium tabular-nums">{item.quantity}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-none"
                      onClick={() => updateQuantity(item.product.id, Math.min(item.quantity + 1, available), item.variantId)}
                      disabled={outOfStock || item.quantity >= available}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <p className="font-semibold shrink-0 self-start">{formatPrice(Number(item.product.price) * item.quantity)} soʻm</p>
            </div>
          );
        })}
      </div>
      <div className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-lg font-bold">Jami: {formatPrice(total)} soʻm</p>
        {hasInvalidStock ? (
          <Button disabled className="w-full sm:w-auto opacity-70">Savatchani yangilang (mahsulot tugadi)</Button>
        ) : (
          <Button asChild className="w-full sm:w-auto"><Link href="/checkout">Buyurtma berish</Link></Button>
        )}
      </div>
    </div>
  );
}
