'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

type PickupAddress = { city?: string; district?: string; street?: string; house?: string; phone?: string } | null;

function formatPickupAddress(addr: PickupAddress): string {
  if (!addr || typeof addr !== 'object') return '';
  const parts = [
    addr.city,
    addr.district,
    addr.street,
    addr.house,
    addr.phone,
  ].filter(Boolean);
  return parts.join(', ');
}

/** Shop can be full (id, name, pickupAddress) or partial from API (e.g. only pickupAddress). */
type ShopLike = { id?: string; name?: string; pickupAddress?: PickupAddress } | null;

interface OrderItem {
  id: string;
  quantity: number;
  price: string;
  product: {
    id: string;
    title: string;
    images?: { url: string }[];
    shop?: ShopLike;
  };
}

interface StoredOrder {
  id: string;
  orderNumber: string;
  deliveryType: string;
  totalAmount: string;
  items: OrderItem[];
  seller?: { shop?: ShopLike } | null;
}

function toStoredOrder(o: {
  id: string;
  orderNumber: string;
  deliveryType: string;
  totalAmount: string;
  items?: { id: string; quantity: number; price: string; product: { id: string; title: string; images?: { url: string }[]; shop?: ShopLike } }[];
  seller?: { shop?: ShopLike } | null;
}): StoredOrder {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    deliveryType: o.deliveryType,
    totalAmount: o.totalAmount,
    items: (o.items ?? []).map((i) => ({
      id: i.id,
      quantity: i.quantity,
      price: i.price,
      product: {
        id: i.product?.id ?? '',
        title: i.product?.title ?? 'Mahsulot',
        images: i.product?.images,
        shop: i.product?.shop ?? null,
      },
    })),
    seller: o.seller ?? null,
  };
}

export function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<StoredOrder[] | null>(null);
  const orderIdFromUrl = searchParams.get('orderId');
  const tokenFromUrl = searchParams.get('token');

  useEffect(() => {
    (async () => {
      try {
        const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('checkout_orders') : null;
        if (raw) {
          const data = JSON.parse(raw) as StoredOrder[];
          setOrders(Array.isArray(data) ? data : [data]);
          sessionStorage.removeItem('checkout_orders');
          return;
        }
        if (orderIdFromUrl && tokenFromUrl) {
          const r = await apiFetch(`${API_URL}/orders/${orderIdFromUrl}/guest-view?token=${encodeURIComponent(tokenFromUrl)}`);
          if (r.ok) {
            const order = await r.json();
            setOrders([toStoredOrder(order)]);
          } else {
            setOrders([]);
          }
          return;
        }
        setOrders([]);
      } catch {
        setOrders([]);
      }
    })();
  }, [orderIdFromUrl, tokenFromUrl]);

  if (orders === null) return <div className="animate-pulse h-24 bg-muted rounded-lg" />;

  const totalSum = orders.reduce((s, o) => s + Number(o.totalAmount), 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Buyurtma qabul qilindi</h1>
        <p className="text-muted-foreground">
          {orders.length === 0
            ? 'Buyurtmalarim sahifasida koʻrishingiz mumkin.'
            : orders.length > 1
              ? `${orders.length} ta buyurtma yaratildi (har bir sotuvchi uchun alohida).`
              : 'Buyurtmalarim sahifasida koʻrishingiz mumkin.'}
        </p>
      </div>

      {orders.length > 0 && (
        <div className="space-y-4">
          {orders.map((order) => {
            const shopName = order.seller?.shop?.name ?? 'Doʻkon';
            const pickupAddress = order.seller?.shop?.pickupAddress ?? null;
            const isPickup = order.deliveryType === 'PICKUP';

            return (
              <Card key={order.id}>
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
                    <p className="text-sm text-muted-foreground mt-1">
                      Sotuvchi siz bilan manzil boʻyicha bogʻlanadi.
                    </p>
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
                        <span className="text-muted-foreground">{item.quantity} × {formatPrice(Number(item.price))} soʻm</span>
                      </li>
                    ))}
                  </ul>
                  <p className="font-semibold pt-1 border-t">
                    Jami: {formatPrice(Number(order.totalAmount))} soʻm
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {orders.length > 1 && totalSum > 0 && (
        <p className="text-center text-muted-foreground">
          Umumiy summa: <strong>{formatPrice(totalSum)} soʻm</strong>
        </p>
      )}

      <div className="flex flex-wrap gap-3 justify-center pt-4">
        {orderIdFromUrl && tokenFromUrl && orders.length > 0 && (
          <Button variant="outline" asChild>
            <Link href={`/order/${orderIdFromUrl}/view?token=${encodeURIComponent(tokenFromUrl)}`}>
              Buyurtmani keyinroq koʻrish (havola)
            </Link>
          </Button>
        )}
        <Button asChild><Link href="/orders">Buyurtmalarim</Link></Button>
        <Button asChild variant="outline"><Link href="/catalog">Katalog</Link></Button>
      </div>
    </div>
  );
}
