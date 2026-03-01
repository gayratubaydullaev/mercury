'use client';

import { ProductVariants } from '@/components/product/product-variants';
import { useProductSelectionOptional } from './product-selection-context';

export function ProductVariantsSection({ isMobile = false }: { isMobile?: boolean }) {
  const ctx = useProductSelectionOptional();
  if (!ctx || !ctx.variantGroups.length) return null;

  return (
    <div className={isMobile ? 'rounded-xl border border-border bg-muted/40 p-3 sm:p-4' : ''}>
      {isMobile && <h2 className="text-sm font-semibold mb-3">Variantni tanlang</h2>}
      <ProductVariants
        variants={ctx.variantGroups}
        selected={ctx.selected}
        onChange={ctx.handleVariantChange}
      />
    </div>
  );
}
