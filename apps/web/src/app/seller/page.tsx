'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, ShoppingBag, BarChart3, Settings, Plus, ExternalLink, ArrowRight } from 'lucide-react';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

type Stats = {
  ordersCount: number;
  pendingOrdersCount?: number;
  totalRevenue: string;
  productsCount?: number;
  shopSlug?: string | null;
  commission?: number;
  totalPaidToPlatform?: number;
  balance?: number;
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
    apiFetch(`${API_URL}/orders/seller`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data: { data?: Order[] }) => setRecentOrders((data?.data ?? []).slice(0, 5)))
      .catch(() => setRecentOrders([]));
  }, [token]);

  if (!token) return <p className="text-muted-foreground">Kirish kerak</p>;

  return (
    <div className="min-w-0 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold mb-2">Sotuvchi kabineti</h1>
          <p className="text-muted-foreground">Doʻkoningiz va buyurtmalarni boshqarish</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/seller/products/new" className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Yangi tovar
            </Link>
          </Button>
          {stats?.shopSlug && (
            <Button variant="outline" asChild>
              <Link href={`/catalog?shop=${encodeURIComponent(stats.shopSlug)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Doʻkonimni koʻrish
              </Link>
            </Button>
          )}
        </div>
      </div>

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.productsCount != null && (
            <Link href="/seller/products">
              <Card className="h-full transition-colors hover:bg-accent/50 hover:border-primary/30">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold">{stats.productsCount}</p>
                    <p className="text-sm text-muted-foreground">Tovarlar</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
          <Link href="/seller/orders">
            <Card className="h-full transition-colors hover:bg-accent/50 hover:border-primary/30">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
                  <ShoppingBag className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold">{stats.ordersCount}</p>
                  <p className="text-sm text-muted-foreground">Buyurtmalar</p>
                  {stats.pendingOrdersCount != null && stats.pendingOrdersCount > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-0.5">Tasdiqlash kutilmoqda: {stats.pendingOrdersCount}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/seller/stats">
            <Card className="h-full transition-colors hover:bg-accent/50 hover:border-primary/30">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-bold truncate" title={formatPrice(Number(stats.totalRevenue))}>{formatPrice(Number(stats.totalRevenue))} soʻm</p>
                  <p className="text-sm text-muted-foreground">Savdolar / Statistika</p>
                  {typeof stats.balance === 'number' && stats.balance > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Komissiya qoldigʻi: {formatPrice(stats.balance)} soʻm</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/seller/settings">
            <Card className="h-full transition-colors hover:bg-accent/50 hover:border-primary/30">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
                  <Settings className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold">Sozlamalar</p>
                  <p className="text-sm text-muted-foreground">Doʻkon, chat, manzil</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Soʻnggi buyurtmalar</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/seller/orders">Barchasi <ArrowRight className="h-4 w-4 ml-1" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentOrders === null ? (
            <Skeleton className="h-32 w-full rounded-lg" />
          ) : recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Hali buyurtmalar yoʻq. <Link href="/seller/products" className="text-primary hover:underline">Tovarlarni</Link> reklama qiling.</p>
          ) : (
            <ul className="space-y-3">
              {recentOrders.map((o) => (
                <li key={o.id}>
                  <Link href="/seller/orders" className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm">{o.orderNumber}</span>
                      <span className="text-muted-foreground text-sm">{o.buyer ? `${o.buyer.firstName} ${o.buyer.lastName}`.trim() || '—' : (o.guestPhone ? `Mehmon (${o.guestPhone})` : 'Mehmon')}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{getOrderStatusLabel(o.status, o.deliveryType)}</span>
                    </div>
                    <span className="font-semibold text-sm">{formatPrice(Number(o.totalAmount))} soʻm</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
