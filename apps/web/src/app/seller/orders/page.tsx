'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Kutilmoqda',
  CONFIRMED: 'Tasdiqlandi',
  PROCESSING: 'Qayta ishlanmoqda',
  SHIPPED: 'Yuborildi',
  DELIVERED: 'Yetkazildi',
  CANCELLED: 'Bekor qilindi',
};

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  deliveryType?: string;
  totalAmount: string;
  createdAt: string;
  buyer: { firstName: string; lastName: string } | null;
  guestPhone?: string | null;
};

export default function SellerOrdersPage() {
  const [data, setData] = useState<{ data: OrderRow[] } | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  useEffect(() => {
    if (!token) return;
    apiFetch(`${API_URL}/orders/seller`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).then(setData);
  }, [token]);

  const updateStatus = (orderId: string, status: string) => {
    if (!token) return;
    apiFetch(`${API_URL}/orders/${orderId}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status }) })
      .then(() => {
        setData((d) => d ? { ...d, data: d.data.map((o) => (o.id === orderId ? { ...o, status } : o)) } : null);
        toast.success(`Buyurtma: ${STATUS_LABELS[status] ?? status}`);
      })
      .catch(() => toast.error('Holat oʻzgartirilmadi'));
  };

  const isPickup = (o: OrderRow) => o.deliveryType === 'PICKUP';

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
            <CardHeader className="pb-2 flex flex-wrap items-center gap-2">
              <span className="font-mono">{o.orderNumber}</span>
              <span className="text-sm text-muted-foreground">{new Date(o.createdAt).toLocaleDateString('uz-UZ')}</span>
              <Badge variant="secondary" className="text-xs">{isPickup(o) ? 'Olib ketish' : 'Yetkazib berish'}</Badge>
              <Badge>{STATUS_LABELS[o.status] ?? o.status}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <p>Buyurtmachi: {o.buyer ? `${o.buyer.firstName} ${o.buyer.lastName}`.trim() || '—' : (o.guestPhone ? `Mehmon (${o.guestPhone})` : 'Mehmon')}</p>
              <p className="font-semibold">{formatPrice(Number(o.totalAmount))} soʻm</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {o.status === 'PENDING' && (
                  <>
                    <Button size="sm" onClick={() => updateStatus(o.id, 'CONFIRMED')}>Tasdiqlash</Button>
                    <Button size="sm" variant="destructive" onClick={() => updateStatus(o.id, 'CANCELLED')}>Bekor qilish</Button>
                  </>
                )}
                {o.status === 'CONFIRMED' && (
                  <>
                    <Button size="sm" onClick={() => updateStatus(o.id, 'PROCESSING')}>Qayta ishlash</Button>
                    <Button size="sm" onClick={() => updateStatus(o.id, 'SHIPPED')}>
                      {isPickup(o) ? 'Tayyor (olib ketish)' : 'Yuborildi'}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => updateStatus(o.id, 'CANCELLED')}>Bekor qilish</Button>
                  </>
                )}
                {o.status === 'PROCESSING' && (
                  <>
                    <Button size="sm" onClick={() => updateStatus(o.id, 'SHIPPED')}>
                      {isPickup(o) ? 'Tayyor (olib ketish)' : 'Yuborildi'}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => updateStatus(o.id, 'CANCELLED')}>Bekor qilish</Button>
                  </>
                )}
                {o.status === 'SHIPPED' && (
                  <Button size="sm" onClick={() => updateStatus(o.id, 'DELIVERED')}>
                    {isPickup(o) ? 'Olib ketildi' : 'Yetkazildi'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
