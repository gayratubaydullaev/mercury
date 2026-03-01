'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

interface Product {
  id: string;
  title: string;
  price: string;
  stock: number;
  isActive: boolean;
  isModerated: boolean;
  images: { url: string }[];
}

export default function SellerProductsPage() {
  const [data, setData] = useState<{ data: Product[] } | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  useEffect(() => {
    if (!token) return;
    apiFetch(`${API_URL}/products/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setData);
  }, [token]);

  if (!token) return <p>Kirish kerak</p>;
  if (!data) return <div className="space-y-4"><Skeleton className="h-24 w-full" /></div>;

  const products = data.data ?? [];

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Tovarlar</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Mahsulotlar roʻyxati va tahrirlash</p>
        </div>
        <Button asChild><Link href="/seller/products/new">Yangi tovar</Link></Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {products.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-4 flex gap-4">
              <div className="relative w-20 h-20 rounded bg-muted shrink-0">
                {p.images?.[0] && <Image src={p.images[0].url} alt="" fill className="object-cover rounded" sizes="80px" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{p.title}</p>
                <p className="text-primary">{formatPrice(Number(p.price))} soʻm</p>
                <p className="text-sm text-muted-foreground">Qoldiq: {p.stock}</p>
                <p className="text-xs mt-0.5">
                  {p.isModerated ? (
                    <span className="text-green-600 font-medium">Tasdiqlangan — katalogda koʻrinadi</span>
                  ) : (
                    <span className="text-amber-600 font-medium">Moderatsiya kutilmoqda — admin tasdiqlagach katalogda chiqadi</span>
                  )}
                </p>
                <Link href={`/seller/products/${p.id}`} className="text-sm text-primary underline">Tahrirlash</Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
