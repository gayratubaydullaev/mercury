'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

export default function AdminOrdersPage() {
  type OrdersResponse =
    | { data: { id: string; orderNumber: string; status: string; totalAmount: string }[] }
    | { message: string };
  const [data, setData] = useState<OrdersResponse | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  useEffect(() => {
    if (!token) return;
    apiFetch(`${API_URL}/admin/orders`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).then(setData);
  }, [token]);

  if (!token) return <p>Kirish kerak</p>;
  if (!data) return <Skeleton className="h-24 w-full" />;

  const orders = 'data' in data ? data.data : [];
  const errorMessage = 'message' in data ? data.message : null;

  return (
    <div className="min-w-0">
      <h1 className="text-xl sm:text-2xl font-bold mb-2">Barcha buyurtmalar</h1>
      <p className="text-muted-foreground mb-6">Platformadagi barcha buyurtmalar</p>
      {orders.length === 0 && errorMessage && (
        <p className="text-destructive text-sm mb-4">{errorMessage}</p>
      )}
      <div className="space-y-3">
        {orders.map((o) => (
          <Card key={o.id}>
            <CardContent className="p-4 flex flex-wrap items-center gap-3">
              <span className="font-mono text-sm">{o.orderNumber}</span>
              <Badge>{o.status}</Badge>
              <span className="font-semibold ml-auto">{formatPrice(Number(o.totalAmount))} soʻm</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
