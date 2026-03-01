'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ReactNode } from 'react';

const NS = 'Koʻrsatilmagan';

type Product = {
  id: string;
  title?: string;
  description?: string | null;
  sku?: string | null;
  specs?: Record<string, string> | null;
  category?: { name?: string } | null;
  shop?: { name?: string } | null;
};

interface ProductSpecsModalProps {
  product: Product;
  trigger?: ReactNode;
}

export function ProductSpecsModal({ product, trigger }: ProductSpecsModalProps) {
  const baseRows = [
    { name: 'Kategoriya', value: product.category?.name || NS },
    { name: 'SKU', value: product.sku || product.id.slice(0, 8) },
    { name: 'Sotuvchi', value: product.shop?.name || NS },
  ];
  const specEntries = product.specs && typeof product.specs === 'object' ? Object.entries(product.specs) : [];
  const rows = [...baseRows, ...specEntries.map(([name, value]) => ({ name, value: String(value) }))];

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2">
            Xususiyatlar va tavsif
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Xususiyatlar va tavsif</DialogTitle>
          <DialogDescription>{product.title ?? ''}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold mb-3 text-lg">Xususiyatlar</h3>
            <div className="flex flex-col gap-0 border rounded-lg overflow-hidden">
              {rows.map((r) => (
                <div
                  key={r.name}
                  className="flex items-center justify-between p-3 border-b last:border-0 hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm text-muted-foreground">{r.name}</span>
                  <span className="text-sm font-medium text-right">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
          {product.description && (
            <div>
              <h3 className="font-semibold mb-3 text-lg">Tavsif</h3>
              <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-line">
                {product.description}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
