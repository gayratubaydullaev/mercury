'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardPanel } from '@/components/dashboard/dashboard-panel';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';
import { ShoppingBag } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Kutilmoqda',
  CONFIRMED: 'Zakazingiz qabul qilindi',
  PROCESSING: 'Tayyorlanmoqda',
  SHIPPED: 'Yuborildi',
  DELIVERED: 'Yetkazildi',
  CANCELLED: 'Bekor qilindi',
};
function getOrderStatusLabel(status: string, deliveryType?: string): string {
  if (deliveryType === 'PICKUP') {
    if (status === 'SHIPPED') return 'Olib ketishga tayyor';
    if (status === 'DELIVERED') return 'Berildi (Olib ketildi)';
  }
  return STATUS_LABELS[status] ?? status;
}
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Kutilmoqda',
  PAID: "To'langan",
  FAILED: 'Muvaffaqiyatsiz',
  REFUNDED: 'Qaytarilgan',
};
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CLICK: 'Click',
  PAYME: 'Payme',
  CASH: 'Naqd',
  CARD_ON_DELIVERY: 'Karta (yetkazishda)',
};

type ShippingAddr = { city?: string; district?: string; street?: string; house?: string; phone?: string; firstName?: string; lastName?: string };
type OrderItemRow = {
  quantity: number;
  price: string;
  product: {
    id: string;
    title: string;
    price: string;
    sku?: string | null;
    unit?: string | null;
    stock?: number;
    options?: unknown;
    specs?: unknown;
  };
  variant?: {
    id?: string;
    options?: Record<string, string> | unknown;
    sku?: string | null;
    stock?: number;
    priceOverride?: string | null;
  } | null;
};
type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus?: string;
  paymentMethod?: string;
  deliveryType?: string;
  totalAmount: string;
  createdAt: string;
  buyer: { firstName: string; lastName: string; email?: string; phone?: string } | null;
  guestPhone?: string | null;
  shippingAddress?: ShippingAddr | null;
  items?: OrderItemRow[];
};

function formatAddress(addr: ShippingAddr | null | undefined): string {
  if (!addr || typeof addr !== 'object') return '—';
  const parts = [addr.city, addr.district, addr.street, addr.house].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

function formatVariantOptions(opts: Record<string, string> | unknown): string {
  if (!opts || typeof opts !== 'object') return '';
  const entries = Object.entries(opts as Record<string, string>);
  return entries.length ? entries.map(([k, v]) => `${k}: ${v}`).join(', ') : '';
}

export default function SellerOrdersPage() {
  const [data, setData] = useState<{ data: OrderRow[] } | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  useEffect(() => {
    if (!token) return;
    apiFetch(`${API_URL}/orders/seller`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).then(setData);
  }, [token]);

  const updateStatus = (orderId: string, status: string, deliveryType?: string) => {
    if (!token) return;
    apiFetch(`${API_URL}/orders/${orderId}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status }) })
      .then(() => {
        setData((d) => d ? { ...d, data: d.data.map((o) => (o.id === orderId ? { ...o, status } : o)) } : null);
        toast.success(`Buyurtma: ${getOrderStatusLabel(status, deliveryType)}`);
      })
      .catch(() => toast.error('Holat oʻzgartirilmadi'));
  };

  const markAsPaid = (orderId: string) => {
    if (!token) return;
    apiFetch(`${API_URL}/orders/${orderId}/mark-paid`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        setData((d) => d ? { ...d, data: d.data.map((o) => (o.id === orderId ? { ...o, paymentStatus: 'PAID' } : o)) } : null);
        toast.success("To'lov belgilandi");
      })
      .catch((e) => toast.error(e?.message ?? "To'lov belgilanmadi"));
  };

  const isPickup = (o: OrderRow) => o.deliveryType === 'PICKUP';
  const isPrepaid = (o: OrderRow) => o.paymentMethod === 'CLICK' || o.paymentMethod === 'PAYME';
  const canShipOrDeliver = (o: OrderRow) => !isPrepaid(o) || o.paymentStatus === 'PAID';

  if (!token) return <DashboardAuthGate />;
  if (!data) return <Skeleton className="h-24 w-full" />;
  const orders = data.data ?? [];

  return (
    <div className="min-w-0 max-w-full">
      <DashboardPageHeader
        eyebrow="Sotuvchi kabineti"
        title="Buyurtmalar"
        description="Doʻkoningizga kelgan buyurtmalar — holatni yangilang va toʻlovni belgilang."
      />
      <DashboardPanel className="p-4 sm:p-5 md:p-6">
        {orders.length === 0 ? (
          <DashboardEmptyState
            icon={ShoppingBag}
            title="Hali buyurtmalar yoʻq"
            description="Birinchi buyurtma kelganda u shu yerda koʻrinadi. Tovarlarni katalogda yangilab turishingiz mumkin."
          />
        ) : (
      <div className="space-y-4">
        {orders.map((o) => (
          <Card key={o.id} className="border-border/70 shadow-none">
            <CardHeader className="flex flex-wrap items-center gap-2 pb-2">
              <span className="font-mono">{o.orderNumber}</span>
              <span className="text-sm text-muted-foreground">{new Date(o.createdAt).toLocaleDateString('uz-UZ')}</span>
              <Badge variant="secondary" className="text-xs">{isPickup(o) ? 'Olib ketish' : 'Yetkazib berish'}</Badge>
              <Badge>{getOrderStatusLabel(o.status, o.deliveryType)}</Badge>
              <Badge variant="outline" className="text-xs">
                💳 {PAYMENT_STATUS_LABELS[o.paymentStatus ?? ''] ?? o.paymentStatus ?? '—'} ({PAYMENT_METHOD_LABELS[o.paymentMethod ?? ''] ?? o.paymentMethod ?? '—'})
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <p>Buyurtmachi: {o.buyer ? `${(o.buyer.firstName ?? '')} ${(o.buyer.lastName ?? '')}`.trim() || '—' : (o.guestPhone ? `Mehmon (${o.guestPhone})` : 'Mehmon')}</p>
              <p>Telefon: {o.buyer?.phone ?? o.guestPhone ?? '—'}</p>
              {!isPickup(o) && (
                <p className="text-sm text-muted-foreground">Manzil: {formatAddress(o.shippingAddress)}</p>
              )}
              {Array.isArray(o.items) && o.items.length > 0 && (
                <div className="rounded-md border overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="bg-muted/50 text-left">
                        <th className="p-2 font-medium">SKU</th>
                        <th className="p-2 font-medium">Mahsulot</th>
                        <th className="p-2 font-medium">Variant</th>
                        <th className="p-2 font-medium">Birlik</th>
                        <th className="p-2 font-medium text-right">Miqdor</th>
                        <th className="p-2 font-medium text-right">Ombordagi</th>
                        <th className="p-2 font-medium text-right">Narx</th>
                        <th className="p-2 font-medium text-right">Summa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {o.items.map((it, idx) => {
                        const variantOpts = it.variant ? formatVariantOptions(it.variant.options) : '';
                        const sku = it.variant?.sku ?? it.product?.sku ?? '—';
                        const unit = it.product?.unit ?? 'dona';
                        const stock = it.variant != null ? it.variant.stock : it.product?.stock;
                        const lineTotal = Number(it.price) * it.quantity;
                        return (
                          <tr key={idx} className="border-t">
                            <td className="p-2 font-mono text-muted-foreground">{sku}</td>
                            <td className="p-2">{it.product?.title ?? 'Mahsulot'}</td>
                            <td className="p-2 text-muted-foreground">{variantOpts || '—'}</td>
                            <td className="p-2 text-muted-foreground">{unit}</td>
                            <td className="p-2 text-right">{it.quantity}</td>
                            <td className="p-2 text-right text-muted-foreground">{stock != null ? stock : '—'}</td>
                            <td className="p-2 text-right">{formatPrice(Number(it.price))} soʻm</td>
                            <td className="p-2 text-right font-medium">{formatPrice(lineTotal)} soʻm</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="font-semibold">Jami: {formatPrice(Number(o.totalAmount))} soʻm</p>
              {(o.paymentMethod === 'CASH' || o.paymentMethod === 'CARD_ON_DELIVERY') && o.paymentStatus === 'PENDING' && (
                <Button size="sm" variant="secondary" onClick={() => markAsPaid(o.id)}>
                  💳 To&apos;lov qabul qilindi
                </Button>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {o.status === 'PENDING' && (
                  <>
                    <Button size="sm" onClick={() => updateStatus(o.id, 'CONFIRMED', o.deliveryType)}>Tasdiqlash</Button>
                    <Button size="sm" variant="destructive" onClick={() => updateStatus(o.id, 'CANCELLED', o.deliveryType)}>Bekor qilish</Button>
                  </>
                )}
                {o.status === 'CONFIRMED' && (
                  <>
                    <Button size="sm" onClick={() => updateStatus(o.id, 'PROCESSING', o.deliveryType)}>Qayta ishlash</Button>
                    {canShipOrDeliver(o) ? (
                      <Button size="sm" onClick={() => updateStatus(o.id, 'SHIPPED', o.deliveryType)}>
                        {isPickup(o) ? 'Tayyor (olib ketish)' : 'Yuborildi'}
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" disabled title={"Click/Payme to'lovi qilinmaguncha belgilab bo'lmaydi"}>
                        {isPickup(o) ? 'Tayyor (olib ketish)' : 'Yuborildi'} — to&apos;lov kutilmoqda
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => updateStatus(o.id, 'CANCELLED', o.deliveryType)}>Bekor qilish</Button>
                  </>
                )}
                {o.status === 'PROCESSING' && (
                  <>
                    {canShipOrDeliver(o) ? (
                      <Button size="sm" onClick={() => updateStatus(o.id, 'SHIPPED', o.deliveryType)}>
                        {isPickup(o) ? 'Tayyor (olib ketish)' : 'Yuborildi'}
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" disabled title={"Click/Payme to'lovi qilinmaguncha belgilab bo'lmaydi"}>
                        {isPickup(o) ? 'Tayyor (olib ketish)' : 'Yuborildi'} — to&apos;lov kutilmoqda
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => updateStatus(o.id, 'CANCELLED', o.deliveryType)}>Bekor qilish</Button>
                  </>
                )}
                {o.status === 'SHIPPED' && (
                  canShipOrDeliver(o) ? (
                    <Button size="sm" onClick={() => updateStatus(o.id, 'DELIVERED', o.deliveryType)}>
                      {isPickup(o) ? 'Olib ketildi' : 'Yetkazildi'}
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" disabled title={"Click/Payme to'lovi qilinmaguncha belgilab bo'lmaydi"}>
                      {isPickup(o) ? 'Olib ketildi' : 'Yetkazildi'} — to&apos;lov kutilmoqda
                    </Button>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
        )}
      </DashboardPanel>
    </div>
  );
}
