'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  FolderTree,
  Package,
  ShoppingBag,
  Settings,
  BarChart3,
  Store,
  MessageSquare,
  ImageIcon,
  Banknote,
  FileCheck,
  FileEdit,
  CreditCard,
  Activity,
} from 'lucide-react';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardKpiCard } from '@/components/dashboard/dashboard-kpi-card';
import { DashboardPanel } from '@/components/dashboard/dashboard-panel';

type RecentOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
  createdAt: string;
  buyer: { firstName: string; lastName: string } | null;
  seller: { firstName: string; lastName: string } | null;
};

type Stats = {
  usersCount: number;
  productsCount: number;
  ordersCount: number;
  paidOrdersCount?: number;
  totalRevenue: string;
  pendingProductsCount?: number;
  pendingReviewsCount?: number;
  ordersByStatus?: Record<string, number>;
  pendingPaymentOrdersCount?: number;
  recentOrders?: RecentOrder[];
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

const mainTiles = [
  { href: '/admin/users', label: 'Foydalanuvchilar', desc: 'Bloklash, rollar', icon: Users },
  { href: '/admin/sellers', label: 'Sotuvchilar', desc: 'Doʻkonlar va komissiya', icon: Store },
  { href: '/admin/seller-applications', label: 'Sotuvchi arizalari', desc: 'Sotuvchi bo‘lish so‘rovlari', icon: FileCheck },
  { href: '/admin/orders', label: 'Barcha buyurtmalar', desc: 'Filtr, qidiruv, eksport', icon: ShoppingBag },
  { href: '/admin/products', label: 'Moderatsiya (tovarlar)', desc: 'Tovarlarni tasdiqlash', icon: Package, badgeKey: 'pendingProductsCount' as keyof Stats },
  { href: '/admin/reviews', label: 'Sharhlar', desc: 'Sharhlar moderatsiyasi', icon: MessageSquare, badgeKey: 'pendingReviewsCount' as keyof Stats },
  { href: '/admin/pending-shop-updates', label: 'Do‘kon o‘zgarishlari', desc: 'Nomi/tavsif — tasdiqlash', icon: FileEdit },
  { href: '/admin/stats', label: 'Analitika', desc: 'Statistika va hisobotlar', icon: BarChart3 },
  { href: '/admin/payouts', label: "Komissiya hisobi", desc: "Savdolar, komissiya, sotuvchidan qabul qilingan", icon: Banknote },
];
const settingsTiles = [
  { href: '/admin/settings', label: 'Platforma sozlamalari', desc: 'Komissiya, toʻlovlar', icon: Settings },
  { href: '/admin/categories', label: 'Toifalar', desc: 'Kategoriyalar boshqaruvi', icon: FolderTree },
  { href: '/admin/banners', label: 'Bannerlar', desc: 'Bosh sahifa bannerlari', icon: ImageIcon },
];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  useEffect(() => {
    if (!token) return;
    apiFetch(`${API_URL}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, [token]);

  const ordersByStatus = stats?.ordersByStatus ?? {};
  const statusTotal = STATUS_ORDER.reduce((s, k) => s + (ordersByStatus[k] ?? 0), 0) || 1;

  return (
    <div className="min-w-0 max-w-full">
      <DashboardPageHeader
        eyebrow="Platforma"
        title="Boshqaruv konsoli"
        description="Buyurtmalar, moderatsiya va sozlamalar — bitta professional paneldan. Filtrlar, qidiruv va tezkor metrikalar."
      />

      {token && !stats && (
        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}

      {stats && (
        <>
          <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <DashboardKpiCard label="Foydalanuvchilar" value={stats.usersCount} href="/admin/users" icon={Users} />
            <DashboardKpiCard label="Faol tovarlar" value={stats.productsCount} href="/admin/products" icon={Package} />
            <DashboardKpiCard label="Buyurtmalar (jami)" value={stats.ordersCount} href="/admin/orders" icon={ShoppingBag} />
            <DashboardKpiCard
              label="To‘langan daromad"
              value={`${formatPrice(Number(stats.totalRevenue))} soʻm`}
              hint={stats.paidOrdersCount != null ? `${stats.paidOrdersCount} ta to‘langan buyurtma` : undefined}
              href="/admin/stats"
              icon={BarChart3}
            />
            <DashboardKpiCard
              label="Moderatsiya: tovarlar"
              value={stats.pendingProductsCount ?? 0}
              variant={(stats.pendingProductsCount ?? 0) > 0 ? 'warning' : 'default'}
              href="/admin/products?filter=pending"
              icon={Package}
            />
            <DashboardKpiCard
              label="Moderatsiya: sharhlar"
              value={stats.pendingReviewsCount ?? 0}
              variant={(stats.pendingReviewsCount ?? 0) > 0 ? 'warning' : 'default'}
              href="/admin/reviews?filter=pending"
              icon={MessageSquare}
            />
            <DashboardKpiCard
              label="To‘lov kutilmoqda"
              value={stats.pendingPaymentOrdersCount ?? 0}
              variant={(stats.pendingPaymentOrdersCount ?? 0) > 0 ? 'warning' : 'default'}
              hint="Bekor qilinmagan buyurtmalar"
              href="/admin/orders?paymentStatus=PENDING"
              icon={CreditCard}
            />
          </div>

          <div className="mb-10 grid gap-6 lg:grid-cols-5">
            <DashboardPanel className="p-4 sm:p-5 lg:col-span-2">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Activity className="h-4 w-4 text-muted-foreground" aria-hidden />
                Buyurtmalar holati
              </div>
              <div className="space-y-3">
                {STATUS_ORDER.map((key) => {
                  const n = ordersByStatus[key] ?? 0;
                  const pct = Math.round((n / statusTotal) * 100);
                  return (
                    <div key={key}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-muted-foreground">{STATUS_LABELS[key] ?? key}</span>
                        <span className="tabular-nums font-medium">{n}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/80 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <Link href="/admin/orders" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
                Barcha buyurtmalar →
              </Link>
            </DashboardPanel>

            <DashboardPanel className="p-4 sm:p-5 lg:col-span-3">
              <div className="mb-4 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">So‘nggi faollik</span>
                <Link href="/admin/orders" className="text-xs font-medium text-primary hover:underline">
                  Barchasi
                </Link>
              </div>
              {!stats.recentOrders?.length ? (
                <p className="text-sm text-muted-foreground">Hozircha buyurtmalar yoʻq.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border/60">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2">Buyurtma</th>
                        <th className="px-3 py-2">Holat</th>
                        <th className="px-3 py-2">To‘lov</th>
                        <th className="px-3 py-2 text-right">Summa</th>
                        <th className="px-3 py-2">Vaqt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentOrders.map((o) => (
                        <tr key={o.id} className="border-b border-border/40 last:border-0 hover:bg-muted/25">
                          <td className="px-3 py-2">
                            <Link
                              href={`/admin/orders/${o.id}`}
                              className="font-mono text-xs text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                            >
                              {o.orderNumber}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{STATUS_LABELS[o.status] ?? o.status}</td>
                          <td className="px-3 py-2 text-muted-foreground">{o.paymentStatus}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">{formatPrice(Number(o.totalAmount))}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(o.createdAt).toLocaleString('uz-UZ', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DashboardPanel>
          </div>
        </>
      )}

      <h2 className="mb-3 text-sm font-semibold tracking-tight text-foreground">Tezkor havolalar</h2>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {mainTiles.map(({ href, label, desc, icon: Icon, badgeKey }) => {
          const count = badgeKey && stats ? (stats[badgeKey] as number | undefined) : undefined;
          return (
            <Link key={href} href={href} className="min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring active:opacity-90">
              <div className="flex h-full items-start gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm ring-1 ring-black/[0.03] transition-colors hover:border-primary/30 hover:bg-muted/20 dark:ring-white/[0.04] sm:gap-4 sm:p-5">
                <div className="rounded-lg border border-border/50 bg-muted/40 p-2.5">
                  <Icon className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold leading-snug">{label}</h3>
                    {count != null && count > 0 && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {count}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <h2 className="mb-3 text-sm font-semibold tracking-tight text-foreground">Katalog va sozlamalar</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {settingsTiles.map(({ href, label, desc, icon: Icon }) => (
          <Link key={href} href={href} className="min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring active:opacity-90">
            <div className="flex h-full items-start gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm ring-1 ring-black/[0.03] transition-colors hover:border-primary/30 hover:bg-muted/20 dark:ring-white/[0.04] sm:gap-4 sm:p-5">
              <div className="rounded-lg border border-border/50 bg-muted/40 p-2.5">
                <Icon className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold leading-snug">{label}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
