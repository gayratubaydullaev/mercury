'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ProductCard, type ProductCardProduct } from '@/components/product/product-card';
import { API_URL } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { type ApiProduct, apiProductToCardProduct } from '@/types/api';

const PAGE_SIZE_DESKTOP = 24;
const PAGE_SIZE_MOBILE = 12;

function getPageSize(): number {
  if (typeof window === 'undefined') return PAGE_SIZE_DESKTOP;
  return window.innerWidth < 768 ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP;
}

export function HomeProductGrid() {
  const [products, setProducts] = useState<ProductCardProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const nextPageRef = useRef(2);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const seedRef = useRef<string | null>(null);
  const pageSizeRef = useRef<number | null>(null);

  const loadPage = useCallback(async (pageNum: number, append: boolean) => {
    const seed = seedRef.current ?? (seedRef.current = `home-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    if (pageSizeRef.current == null) pageSizeRef.current = getPageSize();
    const limit = pageSizeRef.current;
    const url = `${API_URL}/products?sortBy=random&limit=${limit}&page=${pageNum}&seed=${encodeURIComponent(seed)}`;
    try {
      if (append) setLoadingMore(true);
      const res = await fetch(url);
      const json = (await res.json()) as { data?: ApiProduct[]; totalPages?: number };
      if (!json?.data) return;
      const mapped = json.data.map(apiProductToCardProduct);
      if (append) {
        setProducts((prev) => [...prev, ...mapped]);
      } else {
        setProducts(mapped);
      }
      setTotalPages(json.totalPages ?? 1);
      if (!append) nextPageRef.current = 2;
    } catch {
      if (!append) setProducts([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadPage(1, false);
  }, [loadPage]);

  useEffect(() => {
    if (loadingMore || loading) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        const next = nextPageRef.current;
        if (next > totalPages) return;
        nextPageRef.current = next + 1;
        loadPage(next, true);
      },
      { rootMargin: '200px', threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadingMore, loading, totalPages, loadPage]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 md:gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
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
  }

  if (!products.length) {
    return (
      <div className="text-center py-16 md:py-24 bg-muted/30 rounded-2xl border border-dashed">
        <p className="text-muted-foreground mb-4 text-lg">Hozircha mahsulotlar yoʻq</p>
        <Button asChild>
          <Link href="/catalog">Katalogga</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="home-product-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 md:gap-4">
        {products.map((p, index) => (
          <div key={p.id} className="home-product-grid-item">
            <ProductCard product={p} priority={index < 6} />
          </div>
        ))}
      </div>
      <div ref={sentinelRef} className="h-4 min-h-4 w-full" aria-hidden />
      {loadingMore && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 md:gap-4 mt-3 md:mt-4">
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
      )}
    </>
  );
}
