'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';
import { DashboardPanel } from '@/components/dashboard/dashboard-panel';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import { FileCheck } from 'lucide-react';

type Application = {
  id: string;
  userId: string;
  shopName: string;
  description: string | null;
  message: string | null;
  legalType?: string | null;
  legalName?: string | null;
  ogrn?: string | null;
  inn?: string | null;
  documentUrls?: string[] | null;
  status: string;
  rejectReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  user: { id: string; email: string; firstName: string; lastName: string };
};

type Response = { data: Application[]; total: number; page: number; limit: number; totalPages: number };

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Kutilmoqda',
  APPROVED: 'Qabul qilindi',
  REJECTED: 'Rad etildi',
};

export default function AdminSellerApplicationsPage() {
  const [data, setData] = useState<Response | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const load = useCallback(() => {
    if (!token) return;
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    params.set('page', String(page));
    params.set('limit', '20');
    fetch(`${API_URL}/admin/seller-applications?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [token, statusFilter, page]);

  useEffect(() => {
    if (!token) return;
    load();
  }, [token, load]);

  const approve = (id: string) => {
    if (!token) return;
    apiFetch(`${API_URL}/admin/seller-applications/${id}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        toast.success('Ariza qabul qilindi');
        load();
      })
      .catch(() => toast.error('Xatolik'));
  };

  const reject = (id: string) => {
    const reason = rejectReason[id] ?? '';
    if (!token) return;
    apiFetch(`${API_URL}/admin/seller-applications/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason: reason.trim() || undefined }),
    })
      .then(() => {
        toast.success('Ariza rad etildi');
        setRejectReason((r) => ({ ...r, [id]: '' }));
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
        title="Sotuvchi arizalari"
        description="Yangi sotuvchilar uchun arizalarni koʻrib chiqing."
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin">Bosh sahifa</Link>
        </Button>
      </DashboardPageHeader>
      <div className="flex flex-wrap gap-2">
        <Button variant={statusFilter === '' ? 'default' : 'outline'} size="sm" onClick={() => { setStatusFilter(''); setPage(1); }}>Barchasi</Button>
        <Button variant={statusFilter === 'PENDING' ? 'default' : 'outline'} size="sm" onClick={() => { setStatusFilter('PENDING'); setPage(1); }}>Kutilmoqda</Button>
        <Button variant={statusFilter === 'APPROVED' ? 'default' : 'outline'} size="sm" onClick={() => { setStatusFilter('APPROVED'); setPage(1); }}>Qabul qilingan</Button>
        <Button variant={statusFilter === 'REJECTED' ? 'default' : 'outline'} size="sm" onClick={() => { setStatusFilter('REJECTED'); setPage(1); }}>Rad etilgan</Button>
      </div>
      <DashboardPanel className="p-4 sm:p-5 md:p-6">
      <div className="space-y-3">
        {data.data.length === 0 ? (
          <DashboardEmptyState icon={FileCheck} title="Arizalar yoʻq" description="Tanlangan filtr boʻyicha natija topilmadi." />
        ) : (
          data.data.map((app) => (
            <Card key={app.id}>
              <CardContent className="pt-6">
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <p className="font-semibold">{app.shopName}</p>
                    <p className="text-sm text-muted-foreground">
                      {app.user.firstName} {app.user.lastName} — {app.user.email}
                    </p>
                    {app.description && <p className="text-sm mt-1">{app.description}</p>}
                    {app.message && <p className="text-sm mt-1 italic">Xabar: {app.message}</p>}
                    {(app.legalType || app.legalName || app.ogrn || app.inn) && (
                      <div className="mt-2 rounded bg-muted/60 p-2 text-sm">
                        <p className="font-medium text-foreground">Yuridik maʼlumotlar</p>
                        {app.legalType && <p>Shakl: {app.legalType === 'IP' ? 'ИП' : app.legalType === 'OOO' ? 'ООО' : app.legalType}</p>}
                        {app.legalName && <p>Toʻliq nomi: {app.legalName}</p>}
                        {app.ogrn && <p>OGRN: {app.ogrn}</p>}
                        {app.inn && <p>INN: {app.inn}</p>}
                        {Array.isArray(app.documentUrls) && app.documentUrls.length > 0 && (
                          <p>Hujjatlar: {app.documentUrls.length} ta</p>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">{new Date(app.createdAt).toLocaleString('uz-UZ')}</p>
                    <Badge variant={app.status === 'PENDING' ? 'secondary' : app.status === 'APPROVED' ? 'default' : 'destructive'} className="mt-2">
                      {STATUS_LABELS[app.status] ?? app.status}
                    </Badge>
                    {app.status === 'REJECTED' && app.rejectReason && (
                      <p className="text-sm text-destructive mt-1">Sabab: {app.rejectReason}</p>
                    )}
                  </div>
                  {app.status === 'PENDING' && (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        placeholder="Rad etish sababi (ixtiyoriy)"
                        className="rounded-md border border-input px-3 py-2 text-sm w-48"
                        value={rejectReason[app.id] ?? ''}
                        onChange={(e) => setRejectReason((r) => ({ ...r, [app.id]: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => approve(app.id)}>Tasdiqlash</Button>
                        <Button size="sm" variant="destructive" onClick={() => reject(app.id)}>Rad etish</Button>
                      </div>
                    </div>
                  )}
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
