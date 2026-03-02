'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { ArrowLeft } from 'lucide-react';

export default function MyOrdersPage() {
  const [data, setData] = useState<{ data: { id: string; orderNumber: string; status: string; totalAmount: string; createdAt: string; items: { quantity: number; product: { title: string; images: { url: string }[] } }[] }[] } | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  useEffect(() => {
    if (!token) return;
    apiFetch(`${API_URL}/orders/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.status === 403) { setForbidden(true); return null; }
        return r.json();
      })
      .then(setData)
      .catch(() => setData({ data: [] }));
  }, [token]);

  if (!token) return (
    <div className="w-full max-w-2xl mx-auto px-0 sm:px-4 md:px-6 py-8 space-y-4">
      <p className="text-muted-foreground">Buyurtmalaringizni koʻrish uchun tizimga kiring.</p>
      <div className="flex flex-wrap gap-3">
        <Button asChild><Link href="/auth/login?next=/orders">Kirish</Link></Button>
        <Button variant="outline" asChild><Link href="/order/lookup">Mehmon buyurtmasini koʻrish</Link></Button>
      </div>
      <p className="text-sm text-muted-foreground">Tizimga kirmagan holda buyurtma bergan boʻlsangiz, &quot;Mehmon buyurtmasini koʻrish&quot; orqali buyurtma raqami va telefon raqamingizni kiritib koʻring.</p>
    </div>
  );
  if (forbidden) return <div className="w-full max-w-2xl mx-auto px-0 sm:px-4 md:px-6 py-8"><p className="text-muted-foreground mb-4">Buyurtmalar faqat xaridorlar uchun. Sotuvchi boʻlsangiz, doʻkon buyurtmalari Sotuvchi kabinetida.</p><Button asChild variant="outline"><Link href="/account">← Profil</Link></Button></div>;
  if (!data) return <div className="w-full max-w-2xl mx-auto px-0 sm:px-4 md:px-6"><Skeleton className="h-48 w-full rounded-xl" /></div>;

  const orders = data.data ?? [];

  return (
    <div className="w-full max-w-2xl mx-auto px-0 sm:px-4 md:px-6 pb-8">
      <div className="flex flex-wrap items-center gap-3 md:gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild><Link href="/account"><ArrowLeft className="h-4 w-4 mr-1" />Profil</Link></Button>
      </div>
      <h1 className="text-xl sm:text-2xl font-bold mb-2">Buyurtmalarim</h1>
      <p className="text-muted-foreground text-sm mb-6">Barcha buyurtmalar roʻyxati</p>
      {orders.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Hali buyurtma yoʻq. <Link href="/catalog" className="text-primary underline">Katalog</Link></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <Card key={o.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span className="font-mono text-sm">{o.orderNumber}</span>
                  <Badge>{o.status}</Badge>
                  <span className="font-semibold">{formatPrice(Number(o.totalAmount))} soʻm</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{new Date(o.createdAt).toLocaleString('uz-UZ')}</p>
                <ul className="space-y-1">
                  {o.items?.slice(0, 3).map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      {item.product?.images?.[0] && <div className="relative w-8 h-8 rounded bg-muted shrink-0"><Image src={item.product.images[0].url} alt="" fill className="object-cover rounded" sizes="32px" /></div>}
                      <span>{item.product?.title ?? 'Mahsulot'}</span>
                      <span className="text-muted-foreground">× {item.quantity}</span>
                    </li>
                  ))}
                  {(o.items?.length ?? 0) > 3 && <li className="text-xs text-muted-foreground">+{(o.items?.length ?? 0) - 3} boshqa</li>}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
