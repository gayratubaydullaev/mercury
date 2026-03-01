'use client';

import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductCard, type ProductCardProduct } from '@/components/product/product-card';

interface RelatedProductsProps {
  categoryId: string;
  currentProductId: string;
}

export function RelatedProducts({ categoryId, currentProductId }: RelatedProductsProps) {
  const [products, setProducts] = useState<ProductCardProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!categoryId) return;
    const params = new URLSearchParams({ limit: '8', categoryId, sortBy: 'createdAt', sortOrder: 'desc' });
    fetch(`${API_URL}/products?${params}`)
      .then((r) => r.json())
      .then((res) => {
        const list = Array.isArray(res?.data) ? res.data : [];
        setProducts(list.filter((p: ProductCardProduct) => p.id !== currentProductId).slice(0, 6));
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [categoryId, currentProductId]);

  if (loading) {
    return (
      <section className="mt-6 sm:mt-8 lg:mt-12 pt-6 sm:pt-8 border-t min-w-0">
        <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Sizga yoqishi mumkin</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4 min-w-0">
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
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="mt-6 sm:mt-8 lg:mt-12 pt-6 sm:pt-8 border-t min-w-0">
      <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Sizga yoqishi mumkin</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4 min-w-0">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
