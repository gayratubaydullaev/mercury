'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, FolderTree, Package, ShoppingBag, Settings, BarChart3 } from 'lucide-react';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

const tiles = [
  { href: '/admin/users', label: 'Foydalanuvchilar', desc: 'Bloklash, rollar', icon: Users },
  { href: '/admin/orders', label: 'Barcha buyurtmalar', desc: 'Buyurtmalar roʻyxati', icon: ShoppingBag },
  { href: '/admin/stats', label: 'Analitika', desc: 'Statistika va hisobotlar', icon: BarChart3 },
  { href: '/admin/settings', label: 'Platforma sozlamalari', desc: 'Komissiya, toʻlovlar', icon: Settings },
  { href: '/admin/categories', label: 'Toifalar', desc: 'Kategoriyalar boshqaruvi', icon: FolderTree },
  { href: '/admin/products', label: 'Moderatsiya', desc: 'Tovarlar, sharhlar', icon: Package },
];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<{ usersCount: number; productsCount: number; ordersCount: number; totalRevenue: string } | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  useEffect(() => {
    if (!token) return;
    apiFetch(`${API_URL}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).then(setStats).catch(() => {});
  }, [token]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Bosh sahifa</h1>
      <p className="text-muted-foreground mb-6">Platformani boshqarish</p>

      {(token && !stats) && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-1"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-16" /></CardContent>
            </Card>
          ))}
        </div>
      )}
      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">Foydalanuvchilar</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{stats.usersCount}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">Tovarlar</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{stats.productsCount}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">Buyurtmalar</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{stats.ordersCount}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">Daromad</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{formatPrice(Number(stats.totalRevenue))} soʻm</p></CardContent>
          </Card>
        </div>
      )}

      <h2 className="text-lg font-semibold mb-3">Boʻlimlar</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(({ href, label, desc, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="h-full transition-colors hover:bg-accent/50 hover:border-primary/30">
              <CardContent className="p-5 flex items-start gap-4">
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
