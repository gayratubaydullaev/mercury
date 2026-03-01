'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { VariantGroup } from '@/components/product/product-variants';

type Variant = { id: string; options: Record<string, string>; stock: number; imageUrl?: string | null; priceOverride?: unknown };
type Product = {
  id: string;
  options?: Record<string, string[]> | null;
  variants?: Variant[] | null;
  stock: number;
  title?: string;
  price?: string | number;
  comparePrice?: string | number | null;
  images?: { url: string; alt?: string | null }[];
  shop?: { name?: string; slug: string };
  avgRating?: number | null;
  reviewsCount?: number;
};

type SelectedOptions = Record<string, string>;

function findVariant(variants: Variant[] | null | undefined, selected: SelectedOptions): Variant | null {
  if (!variants?.length) return null;
  const sel = Object.entries(selected).filter(([, v]) => v != null && v !== '');
  if (sel.length === 0) return null;
  return variants.find((v) => {
    const o = v.options as Record<string, string>;
    return sel.every(([k, val]) => o[k] === val);
  }) ?? null;
}

function buildVariantGroups(options: Record<string, string[]>): VariantGroup[] {
  return Object.entries(options).map(([id, values]) => ({
    id,
    name: id,
    type: 'text' as const,
    options: values.map((v) => ({ id: v, label: v, value: v })),
  }));
}

type ContextValue = {
  product: Product;
  selected: SelectedOptions;
  variantGroups: VariantGroup[];
  currentVariant: Variant | null;
  stock: number;
  variantId: string | undefined;
  handleVariantChange: (groupId: string, value: string | null) => void;
};

const ProductSelectionContext = createContext<ContextValue | null>(null);

export function useProductSelection() {
  const ctx = useContext(ProductSelectionContext);
  if (!ctx) throw new Error('useProductSelection must be used within ProductSelectionProvider');
  return ctx;
}

export function ProductSelectionProvider({
  product,
  children,
}: {
  product: Product;
  children: React.ReactNode;
}) {
  const options = (product.options as Record<string, string[]> | null) ?? {};
  const variants = (product.variants ?? []) as Variant[];

  // По умолчанию ничего не выбрано — пользователь сам выбирает вариант; повторный клик снимает выбор
  const [selected, setSelected] = useState<SelectedOptions>(() => ({}));

  const variantGroups = useMemo(() => buildVariantGroups(options), [options]);
  const currentVariant = useMemo(() => findVariant(variants, selected), [variants, selected]);
  const stock = currentVariant != null ? currentVariant.stock : product.stock;
  const variantId = currentVariant?.id;

  const handleVariantChange = useCallback((groupId: string, value: string | null) => {
    setSelected((prev) => {
      if (value === null) {
        const { [groupId]: _omit, ...rest } = prev;
        return rest;
      }
      return { ...prev, [groupId]: value };
    });
  }, []);

  const value = useMemo<ContextValue>(
    () => ({
      product,
      selected,
      variantGroups,
      currentVariant,
      stock,
      variantId,
      handleVariantChange,
    }),
    [product, selected, variantGroups, currentVariant, stock, variantId, handleVariantChange]
  );

  return (
    <ProductSelectionContext.Provider value={value}>
      {children}
    </ProductSelectionContext.Provider>
  );
}

export function useProductSelectionOptional() {
  return useContext(ProductSelectionContext);
}
