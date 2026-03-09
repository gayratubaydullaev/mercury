'use client';

import { useProductSelectionOptional } from './product-selection-context';

export function ProductStockLabel() {
  const ctx = useProductSelectionOptional();
  if (!ctx) return null;
  const stock = ctx.stock ?? 0;

  if (stock === 0) {
    return (
      <p className="text-destructive text-sm mt-1 font-medium">
        Hozircha mavjud emas
      </p>
    );
  }
  if (stock <= 10) {
    return (
      <p className="text-amber-600 dark:text-amber-500 text-sm mt-1 font-medium">
        Omborda oz qoldi — {stock} dona
      </p>
    );
  }
  return (
    <p className="text-muted-foreground text-sm mt-1">
      Omborda: {stock} dona
    </p>
  );
}
