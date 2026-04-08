'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';
import { DashboardPanel } from '@/components/dashboard/dashboard-panel';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import { FileEdit } from 'lucide-react';

type PendingUpdate = {
  id: string;
  shopId: string;
  requestedName: string;
  requestedSlug: string;
  requestedDescription: string | null;
  requestedLegalType?: string | null;
  requestedLegalName?: string | null;
  requestedOgrn?: string | null;
  requestedInn?: string | null;
  requestedDocumentUrls?: string[] | null;
  status: string;
  createdAt: string;
  shop: {
    id: string;
    name: string;
    slug: string;
    userId: string;
    user: { email: string; firstName: string; lastName: string };
  };
};

type Response = { data: PendingUpdate[]; total: number; page: number; limit: number; totalPages: number };

export default function AdminPendingShopUpdatesPage() {
  const [data, setData] = useState<Response | null>(null);
  const [page, setPage] = useState(1);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const load = () => {
    if (!token) return;
    fetch(`${API_URL}/admin/pending-shop-updates?page=${page}&limit=20`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  };

  useEffect(() => {
    if (!token) return;
    load();
  }, [token, page]);

  const approve = (id: string) => {
    if (!token) return;
    apiFetch(`${API_URL}/admin/pending-shop-updates/${id}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        toast.success('O‘zgarishlar qabul qilindi');
        load();
      })
      .catch(() => toast.error('Xatolik'));
  };

  const reject = (id: string) => {
    if (!token) return;
    apiFetch(`${API_URL}/admin/pending-shop-updates/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    })
      .then(() => {
        toast.success('So‘rov rad etildi');
        load();
      })
      .catch(() => toast.error('Xatolik'));
  };

  if (!token) return <DashboardAuthGate />;
  if (!data) return <Skeleton className="h-64 w-full rounded-xl" />;

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <DashboardPageHeader
        eyebrow="Platforma"
        title="Doʻkon oʻzgarishlari"
        description="Sotuvchilar nom, slug, tavsif yoki yuridik maʼlumotlarni oʻzgartirganda soʻrovlar shu yerda. Tasdiqlang yoki rad eting."
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin">← Bosh sahifa</Link>
        </Button>
      </DashboardPageHeader>
      <DashboardPanel className="p-4 sm:p-5 md:p-6">
        <div className="space-y-3">
        {data.data.length === 0 ? (
          <DashboardEmptyState icon={FileEdit} title="Kutilayotgan soʻrovlar yoʻq" description="Yangi oʻzgartirishlar kelganda ular shu yerda chiqadi." />
        ) : (
          data.data.map((row) => (
            <Card key={row.id}>
              <CardContent className="pt-6">
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Sotuvchi: {row.shop.user.firstName} {row.shop.user.lastName} — {row.shop.user.email}
                    </p>
                    <p className="font-medium mt-1">Hozirgi: «{row.shop.name}» (slug: {row.shop.slug})</p>
                    <p className="text-sm mt-1 text-primary">So‘ralgan: «{row.requestedName}» (slug: {row.requestedSlug})</p>
                    {row.requestedDescription != null && (
                      <p className="text-sm mt-1">Tavsif: {row.requestedDescription}</p>
                    )}
                    {(row.requestedLegalType || row.requestedLegalName || row.requestedOgrn || row.requestedInn) && (
                      <div className="mt-2 rounded bg-muted/60 p-2 text-sm">
                        <p className="font-medium text-foreground">Yuridik maʼlumotlar</p>
                        {row.requestedLegalType && <p>Shakl: {row.requestedLegalType === 'IP' ? 'ИП' : row.requestedLegalType === 'OOO' ? 'ООО' : row.requestedLegalType}</p>}
                        {row.requestedLegalName && <p>Toʻliq nomi: {row.requestedLegalName}</p>}
                        {row.requestedOgrn && <p>OGRN: {row.requestedOgrn}</p>}
                        {row.requestedInn && <p>INN: {row.requestedInn}</p>}
                        {Array.isArray(row.requestedDocumentUrls) && row.requestedDocumentUrls.length > 0 && (
                          <p>Hujjatlar: {row.requestedDocumentUrls.length} ta</p>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">{new Date(row.createdAt).toLocaleString('uz-UZ')}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => approve(row.id)}>Tasdiqlash</Button>
                    <Button size="sm" variant="destructive" onClick={() => reject(row.id)}>Rad etish</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
        </div>
        {data.totalPages > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Oldingi</Button>
            <span className="py-2 text-sm text-muted-foreground">{page} / {data.totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Keyingi</Button>
          </div>
        )}
      </DashboardPanel>
    </div>
  );
}
