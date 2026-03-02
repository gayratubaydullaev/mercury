'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from 'lucide-react';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

type Stats = {
  usersCount: number;
  productsCount: number;
  ordersCount: number;
  totalRevenue: string;
  pendingProductsCount?: number;
  pendingReviewsCount?: number;
};

const mainTiles = [
  { href: '/admin/users', label: 'Foydalanuvchilar', desc: 'Bloklash, rollar', icon: Users },
  { href: '/admin/sellers', label: 'Sotuvchilar', desc: 'Doʻkonlar va komissiya', icon: Store },
  { href: '/admin/seller-applications', label: 'Sotuvchi arizalari', desc: 'Sotuvchi bo‘lish so‘rovlari', icon: FileCheck },
  { href: '/admin/orders', label: 'Barcha buyurtmalar', desc: 'Buyurtmalar roʻyxati', icon: ShoppingBag },
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

  return (
    <div className="min-w-0 max-w-full">
      <h1 className="text-xl sm:text-2xl font-bold mb-2">Bosh sahifa</h1>
      <p className="text-muted-foreground mb-4 sm:mb-6">Platformani boshqarish</p>

      {(token && !stats) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-6 sm:mb-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-1 px-4 sm:px-6"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent className="px-4 sm:px-6 pt-0"><Skeleton className="h-8 w-16" /></CardContent>
            </Card>
          ))}
        </div>
      )}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-6 sm:mb-8">
          <Card>
            <CardHeader className="pb-1 px-4 sm:px-6"><CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Foydalanuvchilar</CardTitle></CardHeader>
            <CardContent className="px-4 sm:px-6 pt-0"><p className="text-xl sm:text-2xl font-bold">{stats.usersCount}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 px-4 sm:px-6"><CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Tovarlar</CardTitle></CardHeader>
            <CardContent className="px-4 sm:px-6 pt-0"><p className="text-xl sm:text-2xl font-bold">{stats.productsCount}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 px-4 sm:px-6"><CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Buyurtmalar</CardTitle></CardHeader>
            <CardContent className="px-4 sm:px-6 pt-0"><p className="text-xl sm:text-2xl font-bold">{stats.ordersCount}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 px-4 sm:px-6"><CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Daromad</CardTitle></CardHeader>
            <CardContent className="px-4 sm:px-6 pt-0"><p className="text-lg sm:text-2xl font-bold break-words">{formatPrice(Number(stats.totalRevenue))} soʻm</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 px-4 sm:px-6"><CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Tovarlar kutilmoqda</CardTitle></CardHeader>
            <CardContent className="px-4 sm:px-6 pt-0">
              <p className="text-xl sm:text-2xl font-bold">{stats.pendingProductsCount ?? 0}</p>
              {(stats.pendingProductsCount ?? 0) > 0 && (
                <Link href="/admin/products?filter=pending" className="text-sm text-primary hover:underline mt-1 inline-block touch-manipulation">Koʻrish →</Link>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 px-4 sm:px-6"><CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Sharhlar kutilmoqda</CardTitle></CardHeader>
            <CardContent className="px-4 sm:px-6 pt-0">
              <p className="text-xl sm:text-2xl font-bold">{stats.pendingReviewsCount ?? 0}</p>
              {(stats.pendingReviewsCount ?? 0) > 0 && (
                <Link href="/admin/reviews?filter=pending" className="text-sm text-primary hover:underline mt-1 inline-block touch-manipulation">Koʻrish →</Link>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <h2 className="text-base sm:text-lg font-semibold mb-3">Boshqaruv</h2>
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6 sm:mb-8">
        {mainTiles.map(({ href, label, desc, icon: Icon, badgeKey }) => {
          const count = badgeKey && stats ? (stats[badgeKey] as number | undefined) : undefined;
          return (
            <Link key={href} href={href} className="min-w-0 active:opacity-90">
              <Card className="h-full transition-colors hover:bg-accent/50 hover:border-primary/30 active:scale-[0.99]">
                <CardContent className="p-4 sm:p-5 flex items-start gap-3 sm:gap-4">
                  <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{label}</h3>
                      {count != null && count > 0 && (
                        <Badge variant="secondary" className="shrink-0">{count}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <h2 className="text-base sm:text-lg font-semibold mb-3">Katalog va sozlamalar</h2>
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {settingsTiles.map(({ href, label, desc, icon: Icon }) => (
          <Link key={href} href={href} className="min-w-0 active:opacity-90">
            <Card className="h-full transition-colors hover:bg-accent/50 hover:border-primary/30 active:scale-[0.99]">
              <CardContent className="p-4 sm:p-5 flex items-start gap-3 sm:gap-4">
                <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold">{label}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
