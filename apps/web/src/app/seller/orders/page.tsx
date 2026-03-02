'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

export default function SellerOrdersPage() {
  const [data, setData] = useState<{ data: { id: string; orderNumber: string; status: string; totalAmount: string; createdAt: string; buyer: { firstName: string; lastName: string } | null; guestPhone?: string | null }[] } | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  useEffect(() => {
    if (!token) return;
    apiFetch(`${API_URL}/orders/seller`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).then(setData);
  }, [token]);

  const updateStatus = (orderId: string, status: string) => {
    if (!token) return;
    const statusLabels: Record<string, string> = { CONFIRMED: 'Tasdiqlandi', SHIPPED: 'Yuborildi', DELIVERED: 'Yetkazildi' };
    apiFetch(`${API_URL}/orders/${orderId}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status }) })
      .then(() => {
        setData((d) => d ? { ...d, data: d.data.map((o) => (o.id === orderId ? { ...o, status } : o)) } : null);
        toast.success(`Buyurtma: ${statusLabels[status] ?? status}`);
      })
      .catch(() => toast.error('Holat oʻzgartirilmadi'));
  };

  if (!token) return <p>Kirish kerak</p>;
  if (!data) return <Skeleton className="h-24 w-full" />;
  const orders = data.data ?? [];

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold mb-2">Buyurtmalar</h1>
      <p className="text-muted-foreground mb-6">Doʻkoningizga kelgan buyurtmalar</p>
      <div className="space-y-4">
        {orders.map((o) => (
          <Card key={o.id}>
            <CardHeader className="pb-2"><span className="font-mono">{o.orderNumber}</span> <span className="text-sm text-muted-foreground">{new Date(o.createdAt).toLocaleDateString('uz-UZ')}</span></CardHeader>
            <CardContent>
              <p>Buyurtmachi: {o.buyer ? `${o.buyer.firstName} ${o.buyer.lastName}`.trim() || '—' : (o.guestPhone ? `Mehmon (${o.guestPhone})` : 'Mehmon')}</p>
              <p className="font-semibold">{formatPrice(Number(o.totalAmount))} soʻm</p>
              <Badge className="mr-2">{o.status}</Badge>
              {o.status === 'PENDING' && <Button size="sm" onClick={() => updateStatus(o.id, 'CONFIRMED')}>Tasdiqlash</Button>}
              {o.status === 'CONFIRMED' && <Button size="sm" onClick={() => updateStatus(o.id, 'SHIPPED')}>Yuborildi</Button>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
