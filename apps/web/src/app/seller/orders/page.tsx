'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const PAGE_SIZE = 10;
const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

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

type ListResponse = { data: OrderRow[]; total: number; page: number; totalPages: number };

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
  const [data, setData] = useState<ListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const u = new URLSearchParams(window.location.search);
    const s = u.get('status');
    const p = u.get('paymentStatus');
    if (s && (ORDER_STATUSES as readonly string[]).includes(s)) setStatusFilter(s);
    if (p && ['PENDING', 'PAID', 'FAILED', 'REFUNDED'].includes(p)) setPaymentFilter(p);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, paymentFilter, debouncedSearch]);

  const load = useCallback(() => {
    if (!token) return;
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (paymentFilter !== 'all') params.set('paymentStatus', paymentFilter);
    if (debouncedSearch) params.set('search', debouncedSearch);
    apiFetch(`${API_URL}/orders/seller?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((json: ListResponse) =>
        setData({
          data: json.data ?? [],
          total: json.total ?? 0,
          page: json.page ?? 1,
          totalPages: json.totalPages ?? 1,
        })
      )
      .catch(() => setData({ data: [], total: 0, page: 1, totalPages: 0 }));
  }, [token, page, statusFilter, paymentFilter, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = (orderId: string, status: string, deliveryType?: string) => {
    if (!token) return;
    apiFetch(`${API_URL}/orders/${orderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    })
      .then(() => {
        toast.success(`Buyurtma: ${getOrderStatusLabel(status, deliveryType)}`);
        load();
      })
      .catch(() => toast.error('Holat oʻzgartirilmadi'));
  };

  const markAsPaid = (orderId: string) => {
    if (!token) return;
    apiFetch(`${API_URL}/orders/${orderId}/mark-paid`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        toast.success("To'lov belgilandi");
        load();
      })
      .catch((e) => toast.error(e?.message ?? "To'lov belgilanmadi"));
  };

  const isPickup = (o: OrderRow) => o.deliveryType === 'PICKUP';
  const isPrepaid = (o: OrderRow) => o.paymentMethod === 'CLICK' || o.paymentMethod === 'PAYME';
  const canShipOrDeliver = (o: OrderRow) => !isPrepaid(o) || o.paymentStatus === 'PAID';

  if (!token) return <DashboardAuthGate />;
  if (!data) return <Skeleton className="h-24 w-full" />;
  const orders = data.data ?? [];
  const total = data.total ?? 0;
  const totalPages = data.totalPages ?? 1;
  const currentPage = data.page ?? 1;

  return (
    <div className="w-full min-w-0 max-w-full">
      <DashboardPageHeader
        eyebrow="Sotuvchi kabineti"
        title="Buyurtmalar"
        description={`Filtrlar, qidiruv va sahifalash. Jami: ${total} ta buyurtma.`}
      />
      <DashboardPanel className="p-0">
        <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/25 p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[160px] flex-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Qidiruv</label>
            <Input
              placeholder="Raqam, telefon, mijoz..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="w-full min-w-[140px] space-y-1.5 sm:w-40">
            <label className="text-xs font-medium text-muted-foreground">Holat</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Hammasi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Hammasi</SelectItem>
                {ORDER_STATUSES.map((k) => (
                  <SelectItem key={k} value={k}>
                    {STATUS_LABELS[k] ?? k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full min-w-[140px] space-y-1.5 sm:w-44">
            <label className="text-xs font-medium text-muted-foreground">To‘lov holati</label>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Hammasi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Hammasi</SelectItem>
                <SelectItem value="PENDING">Kutilmoqda</SelectItem>
                <SelectItem value="PAID">To‘langan</SelectItem>
                <SelectItem value="FAILED">Muvaffaqiyatsiz</SelectItem>
                <SelectItem value="REFUNDED">Qaytarilgan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="h-9" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Oldingi
              </Button>
              <span className="text-sm text-muted-foreground">
                Sahifa {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Keyingi
              </Button>
            </div>
          )}

          {orders.length === 0 ? (
            <DashboardEmptyState
              icon={ShoppingBag}
              title="Buyurtmalar topilmadi"
              description="Filtr yoki qidiruvni o‘zgartiring — yoki hozircha bo‘sh."
            />
          ) : (
            orders.map((o) => (
              <Card key={o.id} className="border-border/70 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.04]">
                <CardHeader className="flex flex-wrap items-center gap-2 pb-2">
                  <Link
                    href={`/seller/orders/${o.id}`}
                    className="font-mono text-sm font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >
                    {o.orderNumber}
                  </Link>
                  <span className="text-sm text-muted-foreground">{new Date(o.createdAt).toLocaleDateString('uz-UZ')}</span>
                  <Badge variant="secondary" className="text-xs">
                    {isPickup(o) ? 'Olib ketish' : 'Yetkazib berish'}
                  </Badge>
                  <Badge>{getOrderStatusLabel(o.status, o.deliveryType)}</Badge>
                  <Badge variant="outline" className="text-xs">
                    💳 {PAYMENT_STATUS_LABELS[o.paymentStatus ?? ''] ?? o.paymentStatus ?? '—'} (
                    {PAYMENT_METHOD_LABELS[o.paymentMethod ?? ''] ?? o.paymentMethod ?? '—'})
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p>
                    Buyurtmachi:{' '}
                    {o.buyer
                      ? `${(o.buyer.firstName ?? '')} ${(o.buyer.lastName ?? '')}`.trim() || '—'
                      : o.guestPhone
                        ? `Mehmon (${o.guestPhone})`
                        : 'Mehmon'}
                  </p>
                  <p>Telefon: {o.buyer?.phone ?? o.guestPhone ?? '—'}</p>
                  {!isPickup(o) && <p className="text-sm text-muted-foreground">Manzil: {formatAddress(o.shippingAddress)}</p>}
                  {Array.isArray(o.items) && o.items.length > 0 && (
                    <div className="overflow-hidden overflow-x-auto rounded-md border">
                      <table className="w-full min-w-[600px] text-sm">
                        <thead>
                          <tr className="bg-muted/50 text-left">
                            <th className="p-2 font-medium">SKU</th>
                            <th className="p-2 font-medium">Mahsulot</th>
                            <th className="p-2 font-medium">Variant</th>
                            <th className="p-2 font-medium">Birlik</th>
                            <th className="p-2 text-right font-medium">Miqdor</th>
                            <th className="p-2 text-right font-medium">Ombordagi</th>
                            <th className="p-2 text-right font-medium">Narx</th>
                            <th className="p-2 text-right font-medium">Summa</th>
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
                        <Button size="sm" onClick={() => updateStatus(o.id, 'CONFIRMED', o.deliveryType)}>
                          Tasdiqlash
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => updateStatus(o.id, 'CANCELLED', o.deliveryType)}>
                          Bekor qilish
                        </Button>
                      </>
                    )}
                    {o.status === 'CONFIRMED' && (
                      <>
                        <Button size="sm" onClick={() => updateStatus(o.id, 'PROCESSING', o.deliveryType)}>
                          Qayta ishlash
                        </Button>
                        {canShipOrDeliver(o) ? (
                          <Button size="sm" onClick={() => updateStatus(o.id, 'SHIPPED', o.deliveryType)}>
                            {isPickup(o) ? 'Tayyor (olib ketish)' : 'Yuborildi'}
                          </Button>
                        ) : (
                          <Button size="sm" variant="secondary" disabled title={"Click/Payme to'lovi qilinmaguncha belgilab bo'lmaydi"}>
                            {isPickup(o) ? 'Tayyor (olib ketish)' : 'Yuborildi'} — to&apos;lov kutilmoqda
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" onClick={() => updateStatus(o.id, 'CANCELLED', o.deliveryType)}>
                          Bekor qilish
                        </Button>
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
                        <Button size="sm" variant="destructive" onClick={() => updateStatus(o.id, 'CANCELLED', o.deliveryType)}>
                          Bekor qilish
                        </Button>
                      </>
                    )}
                    {o.status === 'SHIPPED' &&
                      (canShipOrDeliver(o) ? (
                        <Button size="sm" onClick={() => updateStatus(o.id, 'DELIVERED', o.deliveryType)}>
                          {isPickup(o) ? 'Olib ketildi' : 'Yetkazildi'}
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" disabled title={"Click/Payme to'lovi qilinmaguncha belgilab bo'lmaydi"}>
                          {isPickup(o) ? 'Olib ketildi' : 'Yetkazildi'} — to&apos;lov kutilmoqda
                        </Button>
                      ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DashboardPanel>
    </div>
  );
}
