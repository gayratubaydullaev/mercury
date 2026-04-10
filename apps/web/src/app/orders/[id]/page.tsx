'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { OrderDetailContent, type OrderDetailData } from '@/components/dashboard/order-detail-content';
import { OrderAuditPanel } from '@/components/dashboard/order-audit-panel';
import { ArrowLeft } from 'lucide-react';

export default function BuyerOrderDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const [order, setOrder] = useState<OrderDetailData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  useEffect(() => {
    if (!token || !id) return;
    apiFetch(`${API_URL}/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.status === 404 || r.status === 403) {
          setNotFound(true);
          return null;
        }
        if (!r.ok) {
          setNotFound(true);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data) setOrder(data as OrderDetailData);
      })
      .catch(() => setNotFound(true));
  }, [token, id]);

  if (!token) {
    return (
      <div className="mx-auto w-full max-w-2xl px-0 py-8 sm:px-4 md:px-6">
        <p className="text-muted-foreground">Buyurtmani koʻrish uchun tizimga kiring.</p>
        <Button asChild className="mt-4">
          <Link href={`/auth/login?next=/orders/${id}`}>Kirish</Link>
        </Button>
      </div>
    );
  }

  if (!id) {
    return (
      <div className="mx-auto w-full max-w-2xl px-0 py-8 sm:px-4 md:px-6">
        <p className="text-muted-foreground">Noto‘g‘ri havola.</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/orders">Buyurtmalarim</Link>
        </Button>
      </div>
    );
  }

  if (order === null && !notFound) {
    return (
      <div className="mx-auto w-full max-w-2xl px-0 py-8 sm:px-4 md:px-6">
        <Skeleton className="mb-6 h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="mx-auto w-full max-w-2xl px-0 py-8 sm:px-4 md:px-6">
        <p className="text-muted-foreground">Buyurtma topilmadi yoki sizga tegishli emas.</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/orders">Buyurtmalarim</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-0 pb-8 sm:px-4 md:px-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/orders">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Buyurtmalarim
          </Link>
        </Button>
      </div>
      <h1 className="mb-1 text-xl font-bold sm:text-2xl">{order.orderNumber}</h1>
      <p className="mb-6 text-sm text-muted-foreground">Tafsilotlar va tarix</p>

      <Card>
        <CardContent className="p-4 sm:p-6">
          <OrderDetailContent order={order} />
        </CardContent>
      </Card>

      <OrderAuditPanel token={token} orderId={id} />
    </div>
  );
}
