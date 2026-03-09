'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import type { NotificationItem } from './notifications-bell';
import { CheckCheck, Loader2 } from 'lucide-react';

type NotificationsPageContentProps = {
  basePath: string;
  title?: string;
};

const PAGE_SIZE = 20;

export function NotificationsPageContent({ basePath, title = 'Bildirishnomalar' }: NotificationsPageContentProps) {
  const [data, setData] = useState<{ data: NotificationItem[]; total: number; page: number; totalPages: number } | null>(null);
  const [page, setPage] = useState(1);
  const [markingAll, setMarkingAll] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const load = () => {
    if (!token) return;
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    apiFetch(`${API_URL}/notifications?${params}`, { headers })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ data: [], total: 0, page: 1, totalPages: 0 }));
  };

  useEffect(() => {
    load();
  }, [token, page]);

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

  if (!token) return <p className="text-muted-foreground">Kirish kerak</p>;
  if (!data) return <Skeleton className="h-64 w-full rounded-xl" />;

  const hasUnread = data.data.some((n) => !n.readAt);

  return (
    <div className="min-w-0 max-w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold">{title}</h1>
        {hasUnread && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
            disabled={markingAll}
            className="gap-2"
          >
            {markingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
            Hammasini o‘qilgan qilish
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-sm">Jami: {data.total}</p>
      {data.totalPages > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            disabled={data.page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Oldingi
          </Button>
          <span className="text-sm text-muted-foreground">
            Sahifa {data.page} / {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={data.page >= data.totalPages}
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
          >
            Keyingi
          </Button>
        </div>
      )}
      {data.data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Bildirishnomalar yo‘q
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {data.data.map((n) => (
            <li key={n.id}>
              <Link href={n.link && n.link.startsWith('/') ? n.link : basePath} onClick={() => !n.readAt && markAsRead(n.id)}>
                <Card className={n.readAt ? undefined : 'border-primary/30 bg-primary/5'}>
                  <CardContent className="p-4">
                    <p className="font-medium text-foreground">{n.title}</p>
                    {n.body && <p className="text-sm text-muted-foreground mt-1">{n.body}</p>}
                    <p className="text-xs text-muted-foreground mt-2">{formatDate(n.createdAt)}</p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
