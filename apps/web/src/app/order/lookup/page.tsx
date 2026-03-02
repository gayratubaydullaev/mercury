'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

type PickupAddress = { city?: string; district?: string; street?: string; house?: string; phone?: string } | null;

function formatPickupAddress(addr: PickupAddress): string {
  if (!addr || typeof addr !== 'object') return '';
  const parts = [addr.city, addr.district, addr.street, addr.house, addr.phone].filter(Boolean);
  return parts.join(', ');
}

export default function OrderLookupPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<{
    id: string;
    orderNumber: string;
    status: string;
    deliveryType: string;
    totalAmount: string;
    items: { id: string; quantity: number; price: string; product: { id: string; title: string; images?: { url: string }[]; shop?: { pickupAddress?: PickupAddress } } }[];
    seller?: { shop?: { id: string; name: string; pickupAddress?: PickupAddress } } | null;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOrder(null);
    const num = orderNumber.trim();
    const phone = guestPhone.trim();
    if (!num || !phone) {
      setError('Buyurtma raqami va telefon raqamini kiriting.');
      return;
    }
    setLoading(true);
    try {
      const r = await apiFetch(
        `${API_URL}/orders/guest-lookup?orderNumber=${encodeURIComponent(num)}&guestPhone=${encodeURIComponent(phone)}`
      );
      if (!r.ok) {
        setError('Buyurtma topilmadi. Raqam va telefonni tekshiring.');
        return;
      }
      const data = await r.json();
      setOrder(data);
    } catch {
      setError('Xatolik yuz berdi. Qaytadan urinib koʻring.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-0 sm:px-4 md:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">← Bosh sahifa</Link>
        </Button>
      </div>
      <h1 className="text-xl sm:text-2xl font-bold">Mehmon buyurtmasini koʻrish</h1>
      <p className="text-muted-foreground text-sm">
        Tizimga kirmagan holda buyurtma bergan boʻlsangiz, buyurtma raqami va buyurtmada koʻrsatilgan telefon raqamingizni kiriting.
      </p>

      {!order ? (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="orderNumber" className="block text-sm font-medium mb-1.5">
                  Buyurtma raqami
                </label>
                <Input
                  id="orderNumber"
                  type="text"
                  placeholder="masalan: ORD-ABC123-00001"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div>
                <label htmlFor="guestPhone" className="block text-sm font-medium mb-1.5">
                  Telefon raqam
                </label>
                <Input
                  id="guestPhone"
                  type="tel"
                  placeholder="+998 90 123 45 67"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? 'Qidirilmoqda...' : 'Buyurtmani koʻrish'}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex flex-wrap items-center gap-2">
                <span>{order.seller?.shop?.name ?? 'Doʻkon'}</span>
                <span className="text-muted-foreground font-normal text-sm">#{order.orderNumber}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted">{order.status}</span>
              </CardTitle>
              {order.deliveryType === 'PICKUP' && order.seller?.shop?.pickupAddress && (
                <p className="text-sm text-muted-foreground mt-1">
                  Olib ketish: {formatPickupAddress(order.seller.shop.pickupAddress) || 'Manzil koʻrsatilmagan'}
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
            <Button variant="outline" onClick={() => { setOrder(null); setError(null); setOrderNumber(''); setGuestPhone(''); }}>
              Boshqa buyurtmani qidirish
            </Button>
            <Button asChild><Link href="/">Bosh sahifa</Link></Button>
          </div>
        </>
      )}

      <p className="text-sm text-muted-foreground">
        Hisobingiz boʻlsa, <Link href="/auth/login?next=/orders" className="text-primary underline">tizimga kiring</Link> va barcha buyurtmalaringizni koʻring.
      </p>
    </div>
  );
}
