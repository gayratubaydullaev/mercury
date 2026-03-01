'use client';

import { useMemo } from 'react';
import { useProductSelectionOptional } from './product-selection-context';
import { ProductGallery } from './product-gallery';
import { MobileProductGallery } from '@/components/product/mobile-product-gallery';

type ProductWithImages = { images?: { url: string; alt?: string | null }[] };

/** Desktop: gallery that shows variant image first when the selected variant has imageUrl */
export function ProductGalleryWithVariant({ product, title }: { product: ProductWithImages; title: string }) {
  const ctx = useProductSelectionOptional();
  const variantImageUrl = ctx?.currentVariant?.imageUrl;
  const images = useMemo(() => {
    const list = product.images ?? [];
    if (variantImageUrl?.trim()) return [{ url: variantImageUrl.trim(), alt: null }, ...list];
    return list;
  }, [product.images, variantImageUrl]);

  return (
    <ProductGallery
      key={ctx?.variantId ?? 'base'}
      images={images}
      title={title}
    />
  );
}

/** Mobile: gallery that shows variant image first when the selected variant has imageUrl */
export function MobileProductGalleryWithVariant({ product, productName }: { product: ProductWithImages; productName: string }) {
  const ctx = useProductSelectionOptional();
  const variantImageUrl = ctx?.currentVariant?.imageUrl;
  const images = useMemo(() => {
    const list = product.images ?? [];
    if (variantImageUrl?.trim()) return [{ url: variantImageUrl.trim(), alt: null }, ...list];
    return list;
  }, [product.images, variantImageUrl]);

  return (
    <MobileProductGallery
      key={ctx?.variantId ?? 'base'}
      images={images}
      productName={productName}
    />
  );
}
