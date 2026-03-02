'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

type PickupAddress = { city?: string; district?: string; street?: string; house?: string; phone?: string } | null;

function formatPickupAddress(addr: PickupAddress): string {
  if (!addr || typeof addr !== 'object') return '';
  const parts = [addr.city, addr.district, addr.street, addr.house, addr.phone].filter(Boolean);
  return parts.join(', ');
}

export default function OrderViewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string | undefined;
  const token = searchParams?.get('token');
  const [order, setOrder] = useState<{
    id: string;
    orderNumber: string;
    deliveryType: string;
    totalAmount: string;
    items: { id: string; quantity: number; price: string; product: { id: string; title: string; images?: { url: string }[]; shop?: { pickupAddress?: PickupAddress } } }[];
    seller?: { shop?: { id: string; name: string; pickupAddress?: PickupAddress } } | null;
  } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id || !token) {
      setError(true);
      return;
    }
    apiFetch(`${API_URL}/orders/${id}/guest-view?token=${encodeURIComponent(token)}`)
      .then((r) => {
        if (!r.ok) {
          setError(true);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data) setOrder(data);
      })
      .catch(() => setError(true));
  }, [id, token]);

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-0 sm:px-4 md:px-6 py-8 text-center space-y-4">
        <h1 className="text-xl font-bold">Buyurtma topilmadi</h1>
        <p className="text-muted-foreground text-sm">
          Havola notoʻgʻri yoki muddati tugagan. Tizimga kiring va &quot;Buyurtmalarim&quot; orqali koʻring.
        </p>
        <Button asChild><Link href="/auth/login?next=/orders">Kirish</Link></Button>
        <Button asChild variant="outline"><Link href="/">Bosh sahifa</Link></Button>
      </div>
    );
  }

  if (!order) {
    return <div className="max-w-lg mx-auto px-0 sm:px-4 py-8 animate-pulse h-48 bg-muted rounded-lg" />;
  }

  const shopName = order.seller?.shop?.name ?? 'Doʻkon';
  const pickupAddress = order.seller?.shop?.pickupAddress ?? null;
  const isPickup = order.deliveryType === 'PICKUP';

  return (
    <div className="max-w-2xl mx-auto px-0 sm:px-4 md:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">← Bosh sahifa</Link>
        <h1 className="text-xl sm:text-2xl font-bold">Buyurtma #{order.orderNumber}</h1>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex flex-wrap items-center gap-2">
            <span>{shopName}</span>
            <span className="text-muted-foreground font-normal text-sm">#{order.orderNumber}</span>
          </CardTitle>
          {isPickup && pickupAddress && (
            <p className="text-sm text-muted-foreground mt-1">
              Olib ketish manzili: {formatPickupAddress(pickupAddress) || 'Manzil koʻrsatilmagan'}
            </p>
          )}
          {isPickup && !pickupAddress && (
            <p className="text-sm text-muted-foreground mt-1">Sotuvchi siz bilan manzil boʻyicha bogʻlanadi.</p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2">
            {order.items?.map((item) => (
              <li key={item.id} className="flex gap-3 items-center text-sm">
                {item.product?.images?.[0] && (
                  <div className="relative w-12 h-12 rounded-md overflow-hidden bg-muted shrink-0">
                    <Image src={item.product.images[0].url} alt="" fill className="object-cover" sizes="48px" />
                  </div>
                )}
                <span className="flex-1 truncate">{item.product?.title ?? 'Mahsulot'}</span>
                <span className="text-muted-foreground">
                  {item.quantity} × {formatPrice(Number(item.price))} soʻm
                </span>
              </li>
            ))}
          </ul>
          <p className="font-semibold pt-1 border-t">Jami: {formatPrice(Number(order.totalAmount))} soʻm</p>
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-3">
        <Button asChild><Link href="/catalog">Katalog</Link></Button>
        <Button asChild variant="outline"><Link href="/">Bosh sahifa</Link></Button>
      </div>
    </div>
  );
}
