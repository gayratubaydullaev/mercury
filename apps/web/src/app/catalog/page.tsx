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
    <div className="space-y-6 min-w-0">
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
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1 md:gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card h-64 animate-pulse" />
      ))}
    </div>
  );
}
