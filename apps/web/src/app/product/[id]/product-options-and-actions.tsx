'use client';

import { useMemo, useState } from 'react';
import { ProductVariants, type VariantGroup } from '@/components/product/product-variants';
import { ProductPageClient } from './product-page-client';

type Variant = { id: string; options: Record<string, string>; stock: number; imageUrl?: string | null };
type Product = {
  id: string;
  options?: Record<string, string[]> | null;
  variants?: Variant[] | null;
  stock: number;
  images?: { url: string }[];
};

type SelectedOptions = Record<string, string>;

/** Нормализация для сравнения опций (пробелы, регистр) — как в product-selection-context */
function norm(s: string): string {
  return String(s ?? '').replace(/\s+/g, '').trim();
}

function getVariantOptionValue(o: Record<string, string>, key: string): string {
  if (o[key] !== undefined) return o[key];
  const lower = key.trim().toLowerCase();
  const entry = Object.entries(o).find(([k]) => k.trim().toLowerCase() === lower);
  return entry?.[1] ?? '';
}

function findVariant(variants: Variant[] | null | undefined, selected: SelectedOptions): Variant | null {
  if (!variants?.length) return null;
  const sel = Object.entries(selected).filter(([, v]) => v != null && norm(v) !== '');
  if (sel.length === 0) return null;
  return variants.find((v) => {
    const o = (v.options ?? {}) as Record<string, string>;
    return sel.every(([k, val]) => norm(getVariantOptionValue(o, k)) === norm(val));
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

export function ProductOptionsAndActions({ product, isMobile = false }: { product: Product; isMobile?: boolean }) {
  const options = (product.options as Record<string, string[]> | null) ?? {};
  const variants = (product.variants ?? []) as Variant[];
  const hasOptions = Object.keys(options).length > 0;
  const variantGroups = useMemo(() => buildVariantGroups(options), [options]);

  const [selected, setSelected] = useState<SelectedOptions>(() => {
    const initial: SelectedOptions = {};
    Object.entries(options).forEach(([k, vals]) => {
      const first = vals?.[0];
      if (first) initial[k] = first;
    });
    return initial;
  });

  const currentVariant = useMemo(() => findVariant(variants, selected), [variants, selected]);
  const stock = currentVariant != null ? currentVariant.stock : product.stock;
  const variantId = currentVariant?.id;

  const handleVariantChange = (groupId: string, value: string | null) => {
    setSelected((prev) => {
      if (value === null) {
        const { [groupId]: _omit, ...rest } = prev;
        return rest;
      }
      return { ...prev, [groupId]: value };
    });
  };

  const optionsBlock = hasOptions ? (
    <div className={isMobile ? 'rounded-lg border border-border bg-muted/50 p-3' : 'rounded-xl border border-border bg-card p-4 shadow-sm'}>
      <h2 className="text-sm font-semibold mb-3">Variantni tanlang</h2>
      <ProductVariants
        variants={variantGroups}
        selected={selected}
        onChange={handleVariantChange}
      />
    </div>
  ) : null;

  const buttons = (
    <ProductPageClient productId={product.id} stock={stock} variantId={variantId ?? undefined} isMobile={isMobile} />
  );

  if (isMobile) {
    return (
      <>
        {optionsBlock}
        <div className="fixed bottom-[calc(3rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 p-2 bg-card/95 backdrop-blur-sm rounded-t-xl border-t border-border shadow-lg">
          <div className="max-w-lg mx-auto px-2">{buttons}</div>
        </div>
      </>
    );
  }

  return (
    <>
      {optionsBlock}
      {buttons}
    </>
  );
}
