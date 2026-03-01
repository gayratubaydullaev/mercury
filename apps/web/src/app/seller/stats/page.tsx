'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

export default function SellerStatsPage() {
  const [stats, setStats] = useState<{
    ordersCount: number;
    pendingOrdersCount?: number;
    totalRevenue: string;
    productsCount?: number;
  } | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  useEffect(() => {
    if (!token) return;
    apiFetch(`${API_URL}/seller/stats`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).then(setStats);
  }, [token]);

  if (!token) return <p>Kirish kerak</p>;
  if (!stats) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="min-w-0">
      <h1 className="text-xl sm:text-2xl font-bold mb-2">Statistika</h1>
      <p className="text-muted-foreground mb-6">Sotuvlar va daromad</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.productsCount != null && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Tovarlar</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{stats.productsCount}</p></CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Buyurtmalar</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.ordersCount}</p>
            {stats.pendingOrdersCount != null && stats.pendingOrdersCount > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">Tasdiqlash kutilmoqda: {stats.pendingOrdersCount}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Daromad (toʻlangan)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatPrice(Number(stats.totalRevenue))} soʻm</p></CardContent>
        </Card>
      </div>
    </div>
  );
}
