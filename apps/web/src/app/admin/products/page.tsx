'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { Package, Check, X } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardPanel } from '@/components/dashboard/dashboard-panel';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';

type Product = {
  id: string;
  title: string;
  price: string;
  isModerated: boolean;
  images: { url: string }[];
  category: { name: string };
  shop: { name: string };
};

export default function AdminProductsPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<{ data: Product[]; total: number; page: number; totalPages: number } | null>(null);
  const [filter, setFilter] = useState<'false' | 'true' | ''>('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  useEffect(() => {
    if (searchParams.get('filter') === 'pending') setFilter('false');
  }, [searchParams]);

  const load = useCallback(() => {
    if (!token) return;
    setLoadError('');
    const q = filter ? `?page=1&limit=50&isModerated=${filter}` : '?page=1&limit=50';
    apiFetch(`${API_URL}/admin/products${q}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoadError(''); })
      .catch(() => { setData({ data: [], total: 0, page: 1, totalPages: 0 }); setLoadError('API ga ulanishda xatolik. Serverni ishga tushiring (pnpm run dev).'); });
  }, [token, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const moderate = (productId: string, approve: boolean) => {
    if (!token) return;
    setLoading(true);
    apiFetch(`${API_URL}/admin/products/${productId}/moderate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ approve }),
    })
      .then(() => {
        toast.success(approve ? 'Tovar tasdiqlandi' : 'Tovar rad etildi');
        load();
      })
      .catch(() => toast.error('Amal bajarilmadi'))
      .finally(() => setLoading(false));
  };

  if (!token) return <DashboardAuthGate />;
  if (data === null) return <Skeleton className="h-64 w-full" />;

  const products = data.data ?? [];

  return (
    <div className="min-w-0 max-w-full space-y-6">
      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      <DashboardPageHeader
        eyebrow="Platforma"
        title="Moderatsiya (tovarlar)"
        description="Yangi va oʻzgartirilgan tovarlarni tasdiqlang yoki rad eting."
      >
        <div className="flex flex-wrap gap-2">
          <Button variant={filter === '' ? 'default' : 'outline'} size="sm" className="min-h-[40px] touch-manipulation" onClick={() => setFilter('')}>Barchasi</Button>
          <Button variant={filter === 'false' ? 'default' : 'outline'} size="sm" className="min-h-[40px] touch-manipulation" onClick={() => setFilter('false')}>Kutilmoqda</Button>
          <Button variant={filter === 'true' ? 'default' : 'outline'} size="sm" className="min-h-[40px] touch-manipulation" onClick={() => setFilter('true')}>Tasdiqlangan</Button>
        </div>
      </DashboardPageHeader>

      <DashboardPanel>
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Package className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            Tovarlar ({data.total})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          {products.length === 0 ? (
            <DashboardEmptyState
              icon={Package}
              title="Tovarlar yoʻq"
              description="Filtr yoki API javobiga koʻra roʻyxat boʻsh. Kutilayotganlar uchun «Kutilmoqda»ni tanlang."
            />
          ) : (
            <ul className="space-y-3">
              {products.map((p) => (
                <li key={p.id} className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border bg-card">
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-muted shrink-0">
                    {p.images?.[0] ? (
                      <Image src={p.images[0].url} alt="" fill className="object-cover" sizes="56px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">Rasm yoʻq</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{p.shop?.name} · {p.category?.name}</p>
                    <p className="text-sm font-medium">{formatPrice(Number(p.price))} soʻm</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {p.isModerated ? (
                      <span className="text-sm text-green-600 font-medium">Tasdiqlangan</span>
                    ) : (
                      <>
                        <Button size="sm" className="min-h-[40px] touch-manipulation text-green-600" onClick={() => moderate(p.id, true)} disabled={loading}>
                          <Check className="h-4 w-4 mr-1" /> Tasdiqlash
                        </Button>
                        <Button size="sm" variant="outline" className="min-h-[40px] touch-manipulation" onClick={() => moderate(p.id, false)} disabled={loading}>
                          <X className="h-4 w-4 mr-1" /> Rad etish
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" className="min-h-[40px] touch-manipulation" asChild>
                      <Link href={`/product/${p.id}`} target="_blank">Koʻrish</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </DashboardPanel>
    </div>
  );
}
