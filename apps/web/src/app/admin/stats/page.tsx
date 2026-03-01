'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { BarChart3, Store } from 'lucide-react';

type PayoutRow = {
  seller: { id: string; firstName: string; lastName: string; email: string };
  total: number;
  commission: number;
  ordersCount: number;
  totalPaid?: number;
  balance?: number;
};

export default function AdminStatsPage() {
  const [stats, setStats] = useState<{ usersCount: number; productsCount: number; ordersCount: number; totalRevenue: string } | null>(null);
  const [payouts, setPayouts] = useState<{ data: PayoutRow[] } | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  useEffect(() => {
    if (!token) return;
    apiFetch(`${API_URL}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).then(setStats);
    apiFetch(`${API_URL}/admin/payouts?limit=20`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).then(setPayouts).catch(() => setPayouts({ data: [] }));
  }, [token]);

  if (!token) return <p>Kirish kerak</p>;
  if (!stats) return <Skeleton className="h-32 w-full" />;

  const sellerRows = Array.isArray(payouts?.data) ? payouts.data : [];

  return (
    <div className="space-y-8 min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold mb-2 flex flex-wrap items-center gap-2">
          <BarChart3 className="h-7 w-7" />
          Analitika
        </h1>
        <p className="text-muted-foreground mb-6">Platforma statistikasi</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Foydalanuvchilar</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{stats.usersCount}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Tovarlar</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{stats.productsCount}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Buyurtmalar</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{stats.ordersCount}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Daromad</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{formatPrice(Number(stats.totalRevenue))} soʻm</p></CardContent>
          </Card>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Store className="h-5 w-5" />
            Sotuvchilar boʻyicha (toʻlangan buyurtmalar)
          </h2>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/payouts">Barchasi</Link>
          </Button>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-2 px-3 font-medium">Sotuvchi</th>
                    <th className="text-right py-2 px-3 font-medium">Buyurtmalar</th>
                    <th className="text-right py-2 px-3 font-medium">Jami</th>
                    <th className="text-right py-2 px-3 font-medium">Komissiya</th>
                    <th className="text-right py-2 px-3 font-medium">Toʻlangan</th>
                    <th className="text-right py-2 px-3 font-medium">Qoldiq</th>
                  </tr>
                </thead>
                <tbody>
                  {sellerRows.slice(0, 10).map((row, i) => (
                    <tr key={row.seller?.id ?? i} className="border-b">
                      <td className="py-2 px-3">
                        <p className="font-medium">{row.seller?.firstName} {row.seller?.lastName}</p>
                        <p className="text-muted-foreground text-xs">{row.seller?.email}</p>
                      </td>
                      <td className="py-2 px-3 text-right">{row.ordersCount}</td>
                      <td className="py-2 px-3 text-right">{formatPrice(row.total)} soʻm</td>
                      <td className="py-2 px-3 text-right">{formatPrice(row.commission)} soʻm</td>
                      <td className="py-2 px-3 text-right">{formatPrice(row.totalPaid ?? 0)} soʻm</td>
                      <td className="py-2 px-3 text-right font-medium">{formatPrice(row.balance ?? row.commission)} soʻm</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sellerRows.length === 0 && <p className="text-muted-foreground text-center py-6">Maʼlumot yoʻq</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
