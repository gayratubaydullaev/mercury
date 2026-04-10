'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, ShoppingBag, BarChart3, Settings, Plus, ExternalLink, ArrowRight, AlertTriangle, CreditCard } from 'lucide-react';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';
import { DashboardKpiCard } from '@/components/dashboard/dashboard-kpi-card';
import { DashboardPanel } from '@/components/dashboard/dashboard-panel';

type Stats = {
  ordersCount: number;
  pendingOrdersCount?: number;
  totalRevenue: string;
  productsCount?: number;
  shopSlug?: string | null;
  shopName?: string | null;
  commission?: number;
  totalPaidToPlatform?: number;
  balance?: number;
  lowStockProductsCount?: number;
  outOfStockProductsCount?: number;
  ordersByStatus?: Record<string, number>;
  unpaidOrdersCount?: number;
};

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  deliveryType?: string;
  totalAmount: string;
  createdAt: string;
  buyer: { firstName: string; lastName: string } | null;
  guestPhone?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Kutilmoqda',
  CONFIRMED: 'Tasdiqlangan',
  PROCESSING: 'Jarayonda',
  SHIPPED: 'Yuborilgan',
  DELIVERED: 'Yetkazilgan',
  CANCELLED: 'Bekor',
};
const STATUS_ORDER = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

function getOrderStatusLabel(status: string, deliveryType?: string): string {
  if (deliveryType === 'PICKUP') {
    if (status === 'SHIPPED') return 'Olib ketishga tayyor';
    if (status === 'DELIVERED') return 'Berildi (Olib ketildi)';
  }
  return STATUS_LABELS[status] ?? status;
}

export default function SellerDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[] | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  useEffect(() => {
    if (!token) return;
    apiFetch(`${API_URL}/seller/stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null));
    const params = new URLSearchParams({ page: '1', limit: '5' });
    apiFetch(`${API_URL}/orders/seller?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data: { data?: Order[] }) => setRecentOrders(data?.data ?? []))
      .catch(() => setRecentOrders([]));
  }, [token]);

  if (!token) return <DashboardAuthGate />;

  const ordersByStatus = stats?.ordersByStatus ?? {};
  const statusTotal = STATUS_ORDER.reduce((s, k) => s + (ordersByStatus[k] ?? 0), 0) || 1;

  return (
    <div className="w-full min-w-0 max-w-full space-y-8">
      <DashboardPageHeader
        eyebrow="Sotuvchi kabineti"
        subtitle={stats?.shopName?.trim() || undefined}
        title="Boshqaruv konsoli"
        description="Buyurtmalar, ombor signallari va tezkor metrikalar — professional sotuvchi paneli."
      >
        <Button asChild>
          <Link href="/seller/products/new" className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Yangi tovar
          </Link>
        </Button>
        {stats?.shopSlug ? (
          <Button variant="outline" asChild>
            <Link
              href={`/catalog?shop=${encodeURIComponent(stats.shopSlug)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Doʻkonimni koʻrish
            </Link>
          </Button>
        ) : null}
      </DashboardPageHeader>

      {!stats ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.productsCount != null && (
            <DashboardKpiCard label="Faol tovarlar" value={stats.productsCount} href="/seller/products" icon={Package} />
          )}
          <DashboardKpiCard
            label="Buyurtmalar"
            value={stats.ordersCount}
            hint={
              stats.pendingOrdersCount != null && stats.pendingOrdersCount > 0
                ? `Tasdiqlash kutilmoqda: ${stats.pendingOrdersCount}`
                : undefined
            }
            href="/seller/orders"
            icon={ShoppingBag}
            variant={stats.pendingOrdersCount != null && stats.pendingOrdersCount > 0 ? 'warning' : 'default'}
          />
          <DashboardKpiCard
            label="Savdolar (to‘langan)"
            value={`${formatPrice(Number(stats.totalRevenue))} soʻm`}
            href="/seller/stats"
            icon={BarChart3}
          />
          <DashboardKpiCard
            label="To‘lov kutilmoqda"
            value={stats.unpaidOrdersCount ?? 0}
            hint="Naqd / karta yetkazish"
            href="/seller/orders?paymentStatus=PENDING"
            icon={CreditCard}
            variant={(stats.unpaidOrdersCount ?? 0) > 0 ? 'warning' : 'default'}
          />
          <DashboardKpiCard
            label="Kam qoldiq (1–5 dona)"
            value={stats.lowStockProductsCount ?? 0}
            href="/seller/products"
            icon={AlertTriangle}
            variant={(stats.lowStockProductsCount ?? 0) > 0 ? 'warning' : 'default'}
          />
          <DashboardKpiCard
            label="Tugagan ombor"
            value={stats.outOfStockProductsCount ?? 0}
            href="/seller/products"
            icon={Package}
            variant={(stats.outOfStockProductsCount ?? 0) > 0 ? 'warning' : 'default'}
          />
          <DashboardKpiCard
            label="Komissiya qoldig‘i"
            value={typeof stats.balance === 'number' ? `${formatPrice(stats.balance)} soʻm` : '—'}
            href="/seller/stats"
            icon={BarChart3}
            variant={typeof stats.balance === 'number' && stats.balance > 0 ? 'warning' : 'default'}
          />
          <Link href="/seller/settings" className="block min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
            <div className="flex h-full items-center gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm ring-1 ring-black/[0.03] transition-colors hover:border-primary/30 hover:bg-muted/15 dark:ring-white/[0.04]">
              <div className="rounded-lg border border-border/50 bg-muted/40 p-2">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sozlamalar</p>
                <p className="font-semibold">Doʻkon va yetkazish</p>
              </div>
            </div>
          </Link>
        </div>
      )}

      {stats && (
        <div className="grid gap-6 lg:grid-cols-2">
          <DashboardPanel className="p-4 sm:p-5">
            <h3 className="mb-4 text-sm font-semibold">Buyurtmalar taqsimoti</h3>
            <div className="space-y-3">
              {STATUS_ORDER.map((key) => {
                const n = ordersByStatus[key] ?? 0;
                const pct = Math.round((n / statusTotal) * 100);
                return (
                  <div key={key}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted-foreground">{STATUS_LABELS[key] ?? key}</span>
                      <Link href={`/seller/orders?status=${key}`} className="tabular-nums font-medium text-primary hover:underline">
                        {n}
                      </Link>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary/80" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </DashboardPanel>
          <Card className="border-border/70 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.04]">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 pb-4">
              <CardTitle className="text-base font-semibold">Soʻnggi buyurtmalar</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/seller/orders" className="gap-1">
                  Barchasi <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              {recentOrders === null ? (
                <Skeleton className="h-32 w-full rounded-lg" />
              ) : recentOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Hali buyurtmalar yoʻq.{' '}
                  <Link href="/seller/products" className="text-primary hover:underline">
                    Tovarlarni
                  </Link>{' '}
                  yangilang.
                </p>
              ) : (
                <ul className="space-y-2">
                  {recentOrders.map((o) => (
                    <li key={o.id}>
                      <Link
                        href={`/seller/orders/${o.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm transition-colors hover:bg-muted/40"
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-medium">{o.orderNumber}</span>
                          <span className="text-muted-foreground">
                            {o.buyer
                              ? `${o.buyer.firstName} ${o.buyer.lastName}`.trim() || '—'
                              : o.guestPhone
                                ? `Mehmon (${o.guestPhone})`
                                : 'Mehmon'}
                          </span>
                          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            {getOrderStatusLabel(o.status, o.deliveryType)}
                          </span>
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums">{formatPrice(Number(o.totalAmount))} soʻm</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
