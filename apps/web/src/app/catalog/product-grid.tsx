'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ProductCard, type ProductCardProduct } from '@/components/product/product-card';
import { API_URL, transliterateCyrillicToLatin } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { swrFetcher } from '@/lib/swr-fetcher';
import { type ApiProduct, type PaginatedResponse, apiProductToCardProduct } from '@/types/api';

export function ProductGrid() {
  const searchParams = useSearchParams();
  const url = useMemo(() => {
    const q = new URLSearchParams();
    q.set('limit', '12');
    const search = searchParams.get('search');
    const categorySlug = searchParams.get('category');
    const shopSlug = searchParams.get('shop');
    const sortBy = searchParams.get('sortBy') ?? (search?.trim() ? 'relevance' : 'createdAt');
    const sortOrder = searchParams.get('sortOrder') ?? (sortBy === 'price' ? 'asc' : 'desc');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    if (search) q.set('search', transliterateCyrillicToLatin(search));
    if (categorySlug) q.set('categorySlug', categorySlug);
    if (shopSlug) q.set('shopSlug', shopSlug);
    q.set('sortBy', sortBy);
    q.set('sortOrder', sortOrder);
    if (minPrice) q.set('minPrice', minPrice);
    if (maxPrice) q.set('maxPrice', maxPrice);
    return `${API_URL}/products?${q.toString()}`;
  }, [searchParams]);

  const { data, isLoading, error } = useSWR<PaginatedResponse<ApiProduct>>(
    url,
    swrFetcher,
    { revalidateOnFocus: true, dedupingInterval: 5000 }
  );

  const loading = isLoading;
  const products = error ? [] : (data?.data ?? []).map(apiProductToCardProduct);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4 min-w-0">
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
    const hadSearch = searchParams.get('search')?.trim();
    return (
      <div className="text-center py-16 md:py-24 bg-muted/30 rounded-2xl border border-dashed">
        <p className="text-muted-foreground mb-4 text-lg">
          {hadSearch ? 'Qidiruv boʻyicha hech narsa topilmadi. Boshqa soʻzlar bilan urinib koʻring.' : 'Hozircha mahsulotlar yoʻq'}
        </p>
        <Button asChild>
          <Link href={hadSearch ? '/catalog' : '/catalog'}>Katalogga</Link>
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: { staggerChildren: 0.1 },
        },
      }}
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4 min-w-0"
    >
      {products.map((p: ProductCardProduct, index: number) => (
        <motion.div
          key={p.id}
          variants={{
            hidden: { opacity: 0, y: 20 },
            show: { opacity: 1, y: 0 },
          }}
        >
          <ProductCard product={p} priority={index < 6} />
        </motion.div>
      ))}
    </motion.div>
  );
}
