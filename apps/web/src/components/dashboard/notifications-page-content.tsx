'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import type { NotificationItem } from './notifications-bell';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardPanel } from '@/components/dashboard/dashboard-panel';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';

type NotificationsPageContentProps = {
  basePath: string;
  title?: string;
  eyebrow?: string;
  description?: string;
};

const PAGE_SIZE = 20;

export function NotificationsPageContent({
  basePath,
  title = 'Bildirishnomalar',
  eyebrow = 'Boshqaruv paneli',
  description = 'Tizim va buyurtmalar boʻyicha xabarnomalar.',
}: NotificationsPageContentProps) {
  const [data, setData] = useState<{ data: NotificationItem[]; total: number; page: number; totalPages: number } | null>(null);
  const [page, setPage] = useState(1);
  const [markingAll, setMarkingAll] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const load = useCallback(() => {
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    apiFetch(`${API_URL}/notifications?${params}`, { headers: h })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ data: [], total: 0, page: 1, totalPages: 0 }));
  }, [token, page]);

  useEffect(() => {
    load();
  }, [load]);

  const markAsRead = (id: string) => {
    if (!token) return;
    apiFetch(`${API_URL}/notifications/${id}/read`, { method: 'PATCH', headers }).then(() => load());
  };

  const markAllAsRead = () => {
    if (!token) return;
    setMarkingAll(true);
    apiFetch(`${API_URL}/notifications/read-all`, { method: 'POST', headers })
      .then(() => load())
      .finally(() => setMarkingAll(false));
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('uz-UZ', { dateStyle: 'short', timeStyle: 'short' });
  };

  if (!token) return <DashboardAuthGate />;
  if (!data) return <Skeleton className="h-64 w-full rounded-xl" />;

  const hasUnread = data.data.some((n) => !n.readAt);

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <DashboardPageHeader eyebrow={eyebrow} title={title} description={`${description} Jami: ${data.total}.`}>
        {hasUnread ? (
          <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={markingAll} className="gap-2">
            {markingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
            Hammasini o‘qilgan qilish
          </Button>
        ) : null}
      </DashboardPageHeader>
      <DashboardPanel className="p-4 sm:p-5 md:p-6">
        {data.totalPages > 1 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Oldingi
            </Button>
            <span className="text-sm text-muted-foreground">
              Sahifa {data.page} / {data.totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={data.page >= data.totalPages} onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}>
              Keyingi
            </Button>
          </div>
        )}
        {data.data.length === 0 ? (
          <DashboardEmptyState icon={Bell} title="Bildirishnomalar yoʻq" description="Yangi hodisalar paydo boʻlganda ular shu yerda chiqadi." />
        ) : (
          <ul className="space-y-2">
            {data.data.map((n) => (
              <li key={n.id}>
                <Link href={n.link && n.link.startsWith('/') ? n.link : basePath} onClick={() => !n.readAt && markAsRead(n.id)}>
                  <Card className={n.readAt ? 'border-border/70 shadow-none' : 'border-primary/30 bg-primary/5'}>
                    <CardContent className="p-4">
                      <p className="font-medium text-foreground">{n.title}</p>
                      {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                      <p className="mt-2 text-xs text-muted-foreground">{formatDate(n.createdAt)}</p>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DashboardPanel>
    </div>
  );
}
