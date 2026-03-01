'use client';

import { Button } from '@/components/ui/button';
import { ProductSpecsModal } from './product-specs-modal';

type Product = {
  id: string;
  title?: string;
  description?: string | null;
  sku?: string | null;
  category?: { name?: string } | null;
  shop?: { name?: string } | null;
};

export function ProductSpecsTrigger({ product, variant = 'link' }: { product: Product; variant?: 'link' | 'outline' }) {
  const trigger =
    variant === 'link' ? (
      <Button
        variant="link"
        className="h-auto p-0 text-blue-600 font-medium hover:no-underline flex items-center gap-1"
      >
        Xususiyatlar va tavsif
        <span className="text-xs ml-1">→</span>
      </Button>
    ) : (
      <Button variant="outline" className="w-full mt-1 h-9 text-sm">
        Barcha xususiyatlar
      </Button>
    );

  return <ProductSpecsModal product={product} trigger={trigger} />;
}
