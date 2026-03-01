'use client';

const NS = 'Koʻrsatilmagan';

type Product = {
  id: string;
  title?: string;
  sku?: string | null;
  category?: { name?: string } | null;
  shop?: { name?: string; slug?: string } | null;
};

export function ProductSpecsInline({ product, compact = false }: { product: Product; compact?: boolean }) {
  const rows = [
    { label: 'SKU', value: product.sku || product.id.slice(0, 8) },
    { label: 'Kategoriya', value: product.category?.name || NS },
    { label: 'Sotuvchi', value: product.shop?.name || NS },
  ];

  if (compact) {
    return (
      <div className="space-y-1 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between">
            <span className="text-muted-foreground">{r.label}</span>
            <span>{r.value}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      {rows.map((r) => (
        <div key={r.label} className="flex">
          <span className="text-muted-foreground w-1/3 shrink-0">{r.label}</span>
          <span className="truncate">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
