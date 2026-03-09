'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Loader2, ChevronRight } from 'lucide-react';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationsBellProps = {
  /** Base path for "Barchasi" link: /admin or /seller */
  basePath: string;
  className?: string;
};

export function NotificationsBell({ basePath, className }: NotificationsBellProps) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<NotificationItem[] | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const fetchUnreadCount = () => {
    if (!token) return;
    apiFetch(`${API_URL}/notifications/unread-count`, { headers })
      .then((r) => r.json())
      .then((data: { count?: number }) => setUnreadCount(data?.count ?? 0))
      .catch(() => {});
  };

  const fetchList = () => {
    if (!token) return;
    setLoading(true);
    apiFetch(`${API_URL}/notifications?limit=10`, { headers })
      .then((r) => r.json())
      .then((data: { data?: NotificationItem[] }) => setList(data?.data ?? []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUnreadCount();
    const t = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(t);
  }, [token]);

  useEffect(() => {
    if (open && token) fetchList();
  }, [open, token]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [open]);

  const markAsRead = (id: string) => {
    if (!token) return;
    apiFetch(`${API_URL}/notifications/${id}/read`, { method: 'PATCH', headers })
      .then(() => {
        setList((prev) => prev?.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)) ?? null);
        setUnreadCount((c) => Math.max(0, c - 1));
      })
      .catch(() => {});
  };

  const markAllAsRead = () => {
    if (!token) return;
    setMarkingAll(true);
    apiFetch(`${API_URL}/notifications/read-all`, { method: 'POST', headers })
      .then(() => {
        setUnreadCount(0);
        setList((prev) => prev?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? null);
      })
      .catch(() => {})
      .finally(() => setMarkingAll(false));
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 60000;
    if (diff < 1) return 'Hozir';
    if (diff < 60) return `${Math.floor(diff)} min`;
    if (diff < 1440) return `${Math.floor(diff / 60)} soat`;
    return d.toLocaleDateString();
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground touch-manipulation"
        aria-label={unreadCount > 0 ? `${unreadCount} ta yangi bildirishnoma` : 'Bildirishnomalar'}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5 md:h-4 md:w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 md:top-1 md:right-1 min-w-[18px] h-[18px] md:min-w-[14px] md:h-[14px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] md:text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-50 w-[min(320px,calc(100vw-2rem))] bg-card border border-border rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
          <div className="p-2 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold">Bildirishnomalar</span>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8"
                onClick={markAllAsRead}
                disabled={markingAll}
              >
                {markingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                Hammasini o‘qilgan
              </Button>
            )}
          </div>
          <div className="overflow-y-auto flex-1 min-h-0">
            {loading ? (
              <div className="p-6 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !list?.length ? (
              <p className="p-4 text-sm text-muted-foreground text-center">Bildirishnomalar yo‘q</p>
            ) : (
              <ul className="py-1">
                {list.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={n.link && n.link.startsWith('/') ? n.link : basePath}
                      onClick={() => {
                        if (!n.readAt) markAsRead(n.id);
                        setOpen(false);
                      }}
                      className={cn(
                        'block px-3 py-2.5 text-left hover:bg-muted/70 transition-colors border-b border-border/60 last:border-0',
                        !n.readAt && 'bg-primary/5'
                      )}
                    >
                      <p className="text-sm font-medium text-foreground line-clamp-1">{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">{formatTime(n.createdAt)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link
            href={`${basePath}/notifications`}
            onClick={() => setOpen(false)}
            className="p-2 border-t border-border flex items-center justify-center gap-1 text-sm text-primary hover:bg-muted/50 font-medium"
          >
            Barchasi <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
