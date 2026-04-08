'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { API_URL, formatPrice } from '@/lib/utils';
import { getCartHeaders, saveCartSessionFromResponse } from '@/lib/cart-session';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { validateCheckoutAddress } from '@/lib/validations';

export function CheckoutForm() {
  const router = useRouter();
  const [cart, setCart] = useState<{
    id: string;
    items: {
      productId: string;
      quantity: number;
      variantId?: string | null;
      product: {
        price: string;
        title?: string;
        stock?: number;
        shop?: { id: string; name: string; pickupAddress?: unknown } | null;
      };
      variant?: { stock: number } | null;
    }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState({
    city: '',
    district: '',
    street: '',
    house: '',
    phone: '',
    email: '',
    firstName: '',
    lastName: '',
  });
  const [deliveryType, setDeliveryType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [paymentMethod, setPaymentMethod] = useState<'CLICK' | 'PAYME' | 'CASH' | 'CARD_ON_DELIVERY'>('CASH');
  const [notes, setNotes] = useState('');
  const [checkoutOptions, setCheckoutOptions] = useState<{ paymentMethods: string[]; deliveryTypes: string[] } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  useEffect(() => {
    apiFetch(`${API_URL}/cart`, { headers: getCartHeaders() })
      .then((r) => r.json())
      .then((data) => {
        saveCartSessionFromResponse(data);
        setCart(data);
      })
      .catch(() => setCart(null));
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/settings/checkout-options`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { paymentMethods?: string[]; deliveryTypes?: string[] } | null) => {
        const methods = data?.paymentMethods?.length ? data.paymentMethods : ['CASH', 'CARD_ON_DELIVERY', 'CLICK', 'PAYME'];
        const types = data?.deliveryTypes?.length ? data.deliveryTypes : ['DELIVERY', 'PICKUP'];
        setCheckoutOptions({ paymentMethods: methods, deliveryTypes: types });
      })
      .catch(() => setCheckoutOptions({ paymentMethods: ['CASH', 'CARD_ON_DELIVERY', 'CLICK', 'PAYME'], deliveryTypes: ['DELIVERY', 'PICKUP'] }));
  }, []);

  const allowedDelivery = checkoutOptions?.deliveryTypes ?? ['DELIVERY', 'PICKUP'];
  const allowedPayment = checkoutOptions?.paymentMethods ?? ['CASH', 'CARD_ON_DELIVERY', 'CLICK', 'PAYME'];
  useEffect(() => {
    if (!checkoutOptions) return;
    const deliveryTypes = checkoutOptions.deliveryTypes?.length
      ? checkoutOptions.deliveryTypes
      : (['DELIVERY', 'PICKUP'] as const);
    const paymentMethods = checkoutOptions.paymentMethods?.length
      ? checkoutOptions.paymentMethods
      : (['CASH', 'CARD_ON_DELIVERY', 'CLICK', 'PAYME'] as const);
    if (!deliveryTypes.includes(deliveryType) && deliveryTypes[0]) setDeliveryType(deliveryTypes[0] as 'DELIVERY' | 'PICKUP');
    if (!paymentMethods.includes(paymentMethod) && paymentMethods[0])
      setPaymentMethod(paymentMethods[0] as 'CLICK' | 'PAYME' | 'CASH' | 'CARD_ON_DELIVERY');
  }, [checkoutOptions, deliveryType, paymentMethod]);

  const { token, setToken } = useAuth();
  const isGuest = !token;

  if (!cart) return <div className="animate-pulse h-32 bg-muted rounded-lg" />;
  if (!cart.items?.length) {
    router.replace('/cart');
    return null;
  }

  const getAvailableStock = (item: (typeof cart.items)[0]) => {
    if (item.variant != null) return item.variant.stock;
    return item.product.stock ?? 0;
  };
  const hasOutOfStock = cart.items.some((item) => {
    const available = getAvailableStock(item);
    return available <= 0 || item.quantity > available;
  });

  const total = cart.items.reduce((s, i) => s + Number(i.product.price) * i.quantity, 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateCheckoutAddress({
      ...address,
      deliveryType,
    });
    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }
    setFieldErrors([]);
    setLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json', ...getCartHeaders() };
      if (token) headers.Authorization = `Bearer ${token}`;
      const shippingAddress = deliveryType === 'DELIVERY'
        ? {
            city: address.city.trim(),
            district: address.district.trim() || undefined,
            street: address.street.trim(),
            house: address.house.trim(),
            phone: address.phone.trim(),
            email: address.email?.trim() || undefined,
          }
        : {
            phone: address.phone.trim(),
            email: address.email?.trim() || undefined,
            firstName: address.firstName?.trim() || undefined,
            lastName: address.lastName?.trim() || undefined,
          };

      const isPayFirst = (paymentMethod === 'CLICK' || paymentMethod === 'PAYME') && token;
      if (isPayFirst) {
        const sessionRes = await apiFetch(`${API_URL}/checkout-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ paymentMethod, deliveryType, shippingAddress, notes: notes.trim() || undefined }),
        });
        if (!sessionRes.ok) {
          const err = await sessionRes.json().catch(() => ({})) as { message?: string; outOfStock?: string[] };
          const msg =
            Array.isArray(err.outOfStock) && err.outOfStock.length > 0
              ? [err.message || 'Xatolik', ...err.outOfStock].join('\n')
              : (err.message || 'Xatolik');
          setFieldErrors([msg]);
          throw new Error(msg);
        }
        const sessionData = await sessionRes.json() as { sessionId: string };
        const sessionId = sessionData.sessionId;
        const successWithSession = typeof window !== 'undefined' ? `${window.location.origin}/checkout/success?session_id=${encodeURIComponent(sessionId)}` : '';
        const pay = await apiFetch(paymentMethod === 'CLICK' ? `${API_URL}/payments/click/init` : `${API_URL}/payments/payme/init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ sessionId, returnUrl: successWithSession }),
        });
        const payData = await pay.json();
        const redirectUrl = payData.redirectUrl ?? payData.paymentUrl;
        if (redirectUrl) window.location.href = redirectUrl;
        else router.push(`/checkout/success?session_id=${encodeURIComponent(sessionId)}`);
        return;
      }

      if ((paymentMethod === 'CLICK' || paymentMethod === 'PAYME') && isGuest) {
        setFieldErrors(['Click yoki Payme uchun tizimga kiring']);
        setLoading(false);
        return;
      }

      const res = await apiFetch(`${API_URL}/orders`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          paymentMethod,
          deliveryType,
          shippingAddress,
          notes: notes.trim() || undefined,
          ...(isGuest
            ? {
                guestPhone: address.phone.trim(),
                guestEmail: address.email?.trim() || undefined,
                guestFirstName: address.firstName?.trim() || undefined,
                guestLastName: address.lastName?.trim() || undefined,
              }
            : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string; outOfStock?: string[]; statusCode?: number };
        const msg =
          res.status === 502
            ? 'Serverni tekshiring. Qayta urinib koʻring.'
            : Array.isArray(err.outOfStock) && err.outOfStock.length > 0
              ? [err.message || 'Xatolik', ...err.outOfStock].join('\n')
              : (err.message || (res.status === 400 ? 'Savat boʻsh boʻlishi yoki maʼlumotlar xato. Savatni tekshiring va qayta urinib koʻring.' : 'Xatolik'));
        setFieldErrors([msg]);
        throw new Error(msg);
      }
      const data = await res.json() as { orders?: unknown[]; guestAuth?: { accessToken: string; user: { id: string } } };
      const orderList = Array.isArray(data) ? data : (data.orders ?? []);
      if (data && !Array.isArray(data) && data.guestAuth) {
        setToken(data.guestAuth.accessToken);
      }
      if (orderList.length > 0 && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('checkout_orders', JSON.stringify(orderList));
      }
      const successUrl =
        isGuest && orderList[0] && (orderList[0] as { id?: string; guestViewToken?: string }).guestViewToken
          ? `/checkout/success?orderId=${encodeURIComponent((orderList[0] as { id: string }).id)}&token=${encodeURIComponent((orderList[0] as { guestViewToken: string }).guestViewToken)}`
          : '/checkout/success';
      router.push(successUrl);
    } catch (err) {
      const msg =
        err instanceof TypeError
          ? 'Tarmoq xatosi. Qayta urinib koʻring.'
          : err instanceof Error
            ? err.message
            : 'Xatolik';
      setFieldErrors([msg]);
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-full space-y-6">
      {hasOutOfStock && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
          <p className="font-medium">Baʼzi mahsulotlar tugagan yoki yetarli miqdorda mavjud emas. Savat sahifasiga oʻtib miqdorni yangilang yoki mahsulotni olib tashlang.</p>
        </div>
      )}
      {fieldErrors.length > 0 && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <ul className="list-disc list-inside space-y-1">
            {fieldErrors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}
      <Card>
        <CardHeader><CardTitle>Yetkazib berish usuli</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {allowedDelivery.includes('DELIVERY') && (
            <label className="flex items-center gap-2">
              <input type="radio" name="delivery" checked={deliveryType === 'DELIVERY'} onChange={() => setDeliveryType('DELIVERY')} />
              Yetkazib berish
            </label>
          )}
          {allowedDelivery.includes('PICKUP') && (
            <label className="flex items-center gap-2">
              <input type="radio" name="delivery" checked={deliveryType === 'PICKUP'} onChange={() => setDeliveryType('PICKUP')} />
              Oʻzim olib ketaman (самовывоз)
            </label>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{deliveryType === 'PICKUP' ? 'Aloqa maʼlumotlari' : 'Yetkazib berish manzili'}</CardTitle>
          {!isGuest && deliveryType === 'DELIVERY' && (
            <p className="text-sm text-muted-foreground font-normal mt-1">Shahar, koʻcha va uy raqami majburiy. Telefon ham kiritilishi shart.</p>
          )}
          {!isGuest && deliveryType === 'PICKUP' && (
            <p className="text-sm text-muted-foreground font-normal mt-1">Aloqa uchun telefon raqamini kiriting.</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {deliveryType === 'DELIVERY' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Shahar *</label>
                  <Input placeholder="Shahar" value={address.city} onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Tuman va mahalla</label>
                  <Input placeholder="Tuman va mahalla" value={address.district} onChange={(e) => setAddress((a) => ({ ...a, district: e.target.value }))} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Koʻcha *</label>
                  <Input placeholder="Koʻcha" value={address.street} onChange={(e) => setAddress((a) => ({ ...a, street: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Uy *</label>
                  <Input placeholder="Uy raqami" value={address.house} onChange={(e) => setAddress((a) => ({ ...a, house: e.target.value }))} className="mt-1" />
                </div>
              </div>
            </>
          )}
          {deliveryType === 'PICKUP' && (() => {
            type ShopRow = { shopName: string; pickupAddress: string; items: { title: string; quantity: number; price: string }[] };
            const byShop = new Map<string, ShopRow>();
            const formatAddr = (a: unknown): string => {
              if (!a || typeof a !== 'object') return '';
              const o = a as Record<string, string>;
              return [o.city, o.district, o.street, o.house, o.phone].filter(Boolean).join(', ');
            };
            for (const item of cart.items) {
              const shop = item.product?.shop;
              const shopId = shop?.id ?? 'unknown';
              const shopName = shop?.name ?? 'Doʻkon';
              const pickupAddress = formatAddr(shop?.pickupAddress);
              if (!byShop.has(shopId)) byShop.set(shopId, { shopName, pickupAddress, items: [] });
              const entry = byShop.get(shopId);
              if (entry) entry.items.push({
                title: item.product?.title ?? 'Mahsulot',
                quantity: item.quantity,
                price: formatPrice(Number(item.product?.price) * item.quantity),
              });
            }
            return (
              <div className="space-y-3">
                <p className="text-sm font-medium">Qaysi doʻkondan nimalarni olib ketishingiz:</p>
                <ul className="space-y-3 text-sm">
                  {Array.from(byShop.entries()).map(([shopId, { shopName, pickupAddress, items }]) => (
                    <li key={shopId} className="rounded-lg border bg-muted/50 p-3">
                      <p><span className="font-medium">Doʻkon: </span>{shopName}</p>
                      <p className="mt-0.5 text-muted-foreground">
                        <span className="font-medium text-foreground/80">Manzil: </span>
                        {pickupAddress || 'Sotuvchi siz bilan bogʻlanadi'}
                      </p>
                      <ul className="mt-1.5 list-inside list-disc text-muted-foreground">
                        {items.map((row, idx) => (
                          <li key={idx}>{row.title} × {row.quantity} — {row.price} soʻm</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
          {(isGuest || deliveryType === 'PICKUP') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">{deliveryType === 'PICKUP' ? 'Ism *' : 'Ism (ixtiyoriy)'}</label>
                <Input placeholder="Ism" value={address.firstName} onChange={(e) => setAddress((a) => ({ ...a, firstName: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">{deliveryType === 'PICKUP' ? 'Familiya *' : 'Familiya (ixtiyoriy)'}</label>
                <Input placeholder="Familiya" value={address.lastName} onChange={(e) => setAddress((a) => ({ ...a, lastName: e.target.value }))} className="mt-1" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Telefon *</label>
              <Input placeholder="+998..." value={address.phone} onChange={(e) => setAddress((a) => ({ ...a, phone: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Email (ixtiyoriy)</label>
              <Input type="email" placeholder="email@example.com" value={address.email} onChange={(e) => setAddress((a) => ({ ...a, email: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Izoh (ixtiyoriy)</label>
            <textarea placeholder="Buyurtma haqida qoʻshimcha" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Toʻlov usuli</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {allowedPayment.map((m) => (
            <label key={m} className="flex items-center gap-2">
              <input type="radio" name="pm" checked={paymentMethod === m} onChange={() => setPaymentMethod(m as typeof paymentMethod)} />
              {m === 'CASH' && 'Naqd'}
              {m === 'CARD_ON_DELIVERY' && 'Karta (qabul qilishda)'}
              {m === 'CLICK' && 'Click'}
              {m === 'PAYME' && 'Payme'}
            </label>
          ))}
        </CardContent>
      </Card>
      <p className="text-lg font-bold">Jami: {formatPrice(total)} soʻm</p>
      <Button type="submit" disabled={loading || hasOutOfStock}>
        {loading ? 'Yuborilmoqda...' : hasOutOfStock ? 'Savatchani yangilang (mahsulot tugadi)' : 'Buyurtma berish'}
      </Button>
    </form>
  );
}
