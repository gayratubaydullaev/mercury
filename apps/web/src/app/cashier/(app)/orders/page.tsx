'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';

const STATUS_UZ: Record<string, string> = {
  PENDING: 'Kutilmoqda',
  CONFIRMED: 'Qabul',
  PROCESSING: 'Tayyorlanmoqda',
  SHIPPED: 'Yo‘lda',
  DELIVERED: 'Berildi',
  CANCELLED: 'Bekor',
};

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus?: string;
  totalAmount: string;
  createdAt: string;
  guestPhone?: string | null;
};

type ListResponse = { data: OrderRow[]; total: number; page: number; totalPages: number };

export default function CashierOrdersListPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [page, setPage] = useState(1);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const load = useCallback(() => {
    if (!token) return;
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    apiFetch(`${API_URL}/orders/seller?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((json: ListResponse) =>
        setData({
          data: json.data ?? [],
          total: json.total ?? 0,
          page: json.page ?? 1,
          totalPages: json.totalPages ?? 1,
        })
      )
      .catch(() => setData({ data: [], total: 0, page: 1, totalPages: 0 }));
  }, [token, page]);

  useEffect(() => {
    load();
  }, [load]);

  if (!token) return <DashboardAuthGate />;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <DashboardPageHeader
        eyebrow="Kassa"
        title="Buyurtmalar"
        description="Doʻkon buyurtmalari. Batafsil uchun qatorni bosing."
        compact
      />
      <Button variant="outline" size="sm" className="gap-2" asChild>
        <Link href="/cashier/pos">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          POS ga qaytish
        </Link>
      </Button>

      {data === null ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : !data.data.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <ShoppingBag className="h-10 w-10 opacity-40" aria-hidden />
            <p>Hozircha buyurtma yoʻq</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {data.data.map((o) => (
            <li key={o.id}>
              <Link href={`/cashier/orders/${o.id}`}>
                <Card className="transition-colors hover:border-primary/30 hover:bg-muted/30">
                  <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div className="min-w-0">
                      <p className="font-semibold tabular-nums">{o.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(o.createdAt).toLocaleString('uz-UZ')}
                        {o.guestPhone ? ` · ${o.guestPhone}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{STATUS_UZ[o.status] ?? o.status}</Badge>
                      <span className="font-bold tabular-nums">{formatPrice(Number(o.totalAmount))}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {data && data.totalPages > 1 ? (
        <div className="flex justify-center gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Oldingi
          </Button>
          <span className="flex items-center px-2 text-sm text-muted-foreground">
            {page} / {data.totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Keyingi
          </Button>
        </div>
      ) : null}
    </div>
  );
}
