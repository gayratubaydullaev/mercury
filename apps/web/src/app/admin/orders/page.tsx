'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus?: string;
  totalAmount: string;
  createdAt: string;
  buyer?: { firstName?: string; lastName?: string };
  seller?: { firstName?: string };
};

type OrdersResponse =
  | { data: OrderRow[]; total: number; page: number; totalPages: number }
  | { message: string };

const PAGE_SIZE = 20;

export default function AdminOrdersPage() {
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [page, setPage] = useState(1);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    apiFetch(`${API_URL}/admin/orders?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ message: 'Xatolik yuz berdi' }));
  }, [token, page]);

  if (!token) return <p>Kirish kerak</p>;
  if (!data) return <Skeleton className="h-24 w-full" />;

  const orders = 'data' in data ? data.data : [];
  const total = 'total' in data ? data.total : 0;
  const totalPages = 'totalPages' in data ? data.totalPages : 1;
  const currentPage = 'page' in data ? data.page : 1;
  const errorMessage = 'message' in data ? data.message : null;

  return (
    <div className="min-w-0 max-w-full">
      <h1 className="text-xl sm:text-2xl font-bold mb-2">Barcha buyurtmalar</h1>
      <p className="text-muted-foreground mb-4 text-sm sm:text-base">Platformadagi barcha buyurtmalar. Jami: {total}</p>
      {errorMessage && orders.length === 0 && (
        <p className="text-destructive text-sm mb-4">{errorMessage}</p>
      )}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Button variant="outline" size="sm" className="min-h-[40px] touch-manipulation" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Oldingi</Button>
          <span className="text-sm text-muted-foreground">Sahifa {currentPage} / {totalPages}</span>
          <Button variant="outline" size="sm" className="min-h-[40px] touch-manipulation" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Keyingi</Button>
        </div>
      )}
      <div className="space-y-3">
        {orders.map((o) => (
          <Card key={o.id}>
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 sm:gap-3 mb-2">
                <span className="font-mono text-sm font-medium">{o.orderNumber}</span>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{o.status}</Badge>
                  {o.paymentStatus && <Badge variant="outline">{o.paymentStatus}</Badge>}
                </div>
                <span className="font-semibold sm:ml-auto text-base">{formatPrice(Number(o.totalAmount))} soʻm</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {o.buyer && (
                  <span>Xaridor: {o.buyer.firstName} {o.buyer.lastName}</span>
                )}
                {o.seller && <span>Sotuvchi: {o.seller.firstName}</span>}
                <span>{o.createdAt ? new Date(o.createdAt).toLocaleString('uz-UZ') : ''}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
