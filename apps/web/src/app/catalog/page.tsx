import { Suspense } from 'react';
import { ProductGrid } from './product-grid';
import { CatalogFilters } from './catalog-filters';
import { CatalogTitle } from './catalog-title';

export const metadata = {
  title: 'Katalog',
  description: 'Barcha mahsulotlar',
};

function CatalogHeaderFallback() {
  return (
    <div className="flex flex-wrap gap-4 animate-pulse">
      <div className="h-10 w-36 rounded bg-muted" />
      <div className="h-10 w-28 rounded bg-muted" />
      <div className="h-10 w-32 rounded bg-muted" />
    </div>
  );
}

export default function CatalogPage() {
  return (
    <div className="space-y-4 sm:space-y-6 min-w-0 max-w-full overflow-x-hidden">
      <Suspense fallback={<CatalogHeaderFallback />}>
        <CatalogTitle />
        <CatalogFilters />
      </Suspense>
      <Suspense fallback={<ProductGridSkeleton />}>
        <ProductGrid />
      </Suspense>
    </div>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4 min-w-0">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card aspect-[4/5] animate-pulse min-w-0" />
      ))}
    </div>
  );
}
