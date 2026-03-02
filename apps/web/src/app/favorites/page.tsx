'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductCard } from '@/components/product/product-card';
import { API_URL, isTokenExpired } from '@/lib/utils';
import { apiFetch, apiGetJson } from '@/lib/api';
import { getGuestFavoriteIds, removeGuestFavorite } from '@/lib/guest-favorites';
import { useAuth } from '@/contexts/auth-context';
import { type ApiProduct, apiProductToCardProduct } from '@/types/api';

interface FavItem {
  id: string;
  product: ApiProduct;
}

async function fetchProductOrNull(id: string): Promise<ApiProduct | null> {
  try {
    const r = await apiFetch(`${API_URL}/products/${id}`);
    if (!r.ok) {
      removeGuestFavorite(id);
      return null;
    }
    const p = (await r.json()) as ApiProduct;
    return p?.id ? p : null;
  } catch {
    removeGuestFavorite(id);
    return null;
  }
}

const FavoritesSkeleton = () => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 md:gap-4">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="flex flex-col gap-3">
        <Skeleton className="aspect-[4/5] w-full rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-5 w-1/3" />
        </div>
      </div>
    ))}
  </div>
);

export default function FavoritesPage() {
  const { token, setToken } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [list, setList] = useState<FavItem[] | null>(null);
  const [guestIds, setGuestIds] = useState<string[]>([]);

  const fetchFavs = (t: string | null) => {
    if (!t || isTokenExpired(t)) {
      if (t) setToken(null);
      return;
    }
    apiGetJson<FavItem[]>(`${API_URL}/favorites`, { headers: { Authorization: `Bearer ${t}` } })
      .then(setList)
      .catch(() => setList([]));
  };

  const fetchGuestFavs = () => {
    const ids = getGuestFavoriteIds();
    setGuestIds(ids);
    if (ids.length === 0) {
      setList([]);
      return;
    }
    Promise.all(ids.map((id) => fetchProductOrNull(id)))
      .then((products) => {
        setList(
          products.filter((p): p is ApiProduct => p != null).map((p) => ({ id: p.id, product: p }))
        );
      })
      .catch(() => setList([]));
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const t = token;
    if (t && isTokenExpired(t)) {
      setToken(null);
      const ids = getGuestFavoriteIds();
      setGuestIds(ids);
      if (ids.length === 0) setList([]);
      else {
        Promise.all(ids.map((id) => fetchProductOrNull(id)))
          .then((products) => {
            setList(
              products.filter((p): p is ApiProduct => p != null).map((p) => ({ id: p.id, product: p }))
            );
          })
          .catch(() => setList([]));
      }
      return;
    }
    if (t) {
      apiGetJson<FavItem[]>(`${API_URL}/favorites`, { headers: { Authorization: `Bearer ${t}` } })
        .then(setList)
        .catch(() => setList([]));
    } else {
      const ids = getGuestFavoriteIds();
      setGuestIds(ids);
      if (ids.length === 0) setList([]);
      else {
        Promise.all(ids.map((id) => fetchProductOrNull(id)))
          .then((products) => {
            setList(
              products.filter((p): p is ApiProduct => p != null).map((p) => ({ id: p.id, product: p }))
            );
          })
          .catch(() => setList([]));
      }
    }
  }, [mounted, token, setToken]);

  useEffect(() => {
    if (!mounted || token) return;
    const handler = () => {
      const ids = getGuestFavoriteIds();
      setGuestIds(ids);
      if (ids.length === 0) {
        setList([]);
        return;
      }
      Promise.all(ids.map((id) => fetchProductOrNull(id)))
        .then((products) => {
          setList(
            products.filter((p): p is ApiProduct => p != null).map((p) => ({ id: p.id, product: p }))
          );
        })
        .catch(() => setList([]));
    };
    window.addEventListener('guest-favorites-changed', handler);
    return () => window.removeEventListener('guest-favorites-changed', handler);
  }, [mounted, token]);

  const removeFromList = (productId: string) => {
    if (token) {
      setList((prev) => (prev ?? []).filter((f) => f.product.id !== productId));
    } else {
      removeGuestFavorite(productId);
      setList((prev) => (prev ?? []).filter((f) => f.product.id !== productId));
    }
  };

  if (!mounted) {
    return <FavoritesSkeleton />;
  }

  if (list === null) {
    return <FavoritesSkeleton />;
  }

  if (!list.length) {
    return (
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold mb-6">Sevimlilar</h1>
        <p className="text-muted-foreground">
          Sevimlilar boʻsh. <Link href="/catalog" className="text-primary underline">Katalog</Link>
          {!token && <span> — mehmon sifatida saqlangan sevimlilar shu yerda koʻrinadi.</span>}
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <h1 className="text-xl sm:text-2xl font-bold mb-6">Sevimlilar</h1>
      {!token && <p className="text-muted-foreground text-sm mb-4">Mehmon rejimida. Kirish orqali sevimlilar hisobingizga saqlanadi.</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 md:gap-4">
        {list.map((fav) => (
          <ProductCard
            key={fav.id}
            product={apiProductToCardProduct(fav.product)}
            initialFavorite
            onFavoriteChange={(inFavorites) => {
              if (!inFavorites) removeFromList(fav.product.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}
