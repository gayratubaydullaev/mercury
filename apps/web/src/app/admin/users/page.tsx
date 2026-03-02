'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, cn } from '@/lib/utils';
import { apiFetch, apiGetJson } from '@/lib/api';
import { isApiError } from '@/types/api';
import { User } from 'lucide-react';

const ROLES = ['BUYER', 'SELLER', 'ADMIN'] as const;
const ROLE_LABELS: Record<string, string> = { BUYER: 'Xaridor', SELLER: 'Sotuvchi', ADMIN: 'Admin' };

interface AdminUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  role: string;
  isBlocked: boolean;
}

interface AdminUsersResponse {
  data: AdminUser[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  message?: string;
}

const PAGE_SIZE = 20;

function displayName(u: AdminUser): string {
  const first = (u.firstName ?? u.first_name ?? '').trim();
  const last = (u.lastName ?? u.last_name ?? '').trim();
  const name = `${first} ${last}`.trim();
  return name || u.email || '—';
}

export default function AdminUsersPage() {
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const load = () => {
    if (!token) return;
    const params = new URLSearchParams();
    if (roleFilter) params.set('role', roleFilter);
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    const q = `?${params.toString()}`;
    apiGetJson<AdminUsersResponse>(`${API_URL}/admin/users${q}`, { headers: { Authorization: `Bearer ${token}` } }).then(setData).catch(() => setData(null));
  };

  useEffect(() => {
    load();
  }, [token, roleFilter, page]);

  const block = (id: string, block: boolean) => {
    if (!token) return;
    apiFetch(`${API_URL}/admin/users/${id}/block`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ block }) })
      .then(() => {
        setData((d) => {
          if (!d || !Array.isArray(d.data)) return d;
          return { ...d, data: d.data.map((u) => (u.id === id ? { ...u, isBlocked: block } : u)) };
        });
        toast.success(block ? 'Foydalanuvchi bloklandi' : 'Foydalanuvchi blokdan chiqarildi');
      })
      .catch(() => toast.error('Amal bajarilmadi'));
  };

  const setRole = (id: string, role: string) => {
    if (!token || !ROLES.includes(role as typeof ROLES[number])) return;
    apiFetch(`${API_URL}/admin/users/${id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role }),
    })
      .then(() => {
        setData((d) => {
          if (!d || !Array.isArray(d.data)) return d;
          return { ...d, data: d.data.map((u) => (u.id === id ? { ...u, role } : u)) };
        });
        toast.success(`Rol oʻzgartirildi: ${ROLE_LABELS[role] ?? role}`);
      })
      .catch(() => toast.error('Rol saqlanmadi'));
  };

  if (!token) return <p>Kirish kerak</p>;
  if (!data) return <Skeleton className="h-64 w-full" />;

  const users = Array.isArray(data?.data) ? data.data : [];

  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const currentPage = data?.page ?? 1;

  return (
    <div className="min-w-0 max-w-full">
      <h1 className="text-xl sm:text-2xl font-bold mb-2">Foydalanuvchilar</h1>
      <p className="text-muted-foreground mb-4 text-sm sm:text-base">Koʻrish, bloklash va rol berish. Jami: {total}</p>
      <div className="flex flex-wrap gap-2 mb-4">
        <Button variant={roleFilter === '' ? 'default' : 'outline'} size="sm" className="min-h-[40px] touch-manipulation" onClick={() => { setRoleFilter(''); setPage(1); }}>Barchasi</Button>
        {ROLES.map((r) => (
          <Button key={r} variant={roleFilter === r ? 'default' : 'outline'} size="sm" className="min-h-[40px] touch-manipulation" onClick={() => { setRoleFilter(r); setPage(1); }}>{ROLE_LABELS[r]}</Button>
        ))}
      </div>
      {users.length === 0 && isApiError(data) && data.message && (
        <p className="text-destructive text-sm mb-4">{data.message}</p>
      )}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Oldingi</Button>
          <span className="text-sm text-muted-foreground">Sahifa {currentPage} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Keyingi</Button>
        </div>
      )}
      <div className="space-y-3 max-w-3xl">
        {users.map((u) => (
          <Card key={u.id}>
            <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row flex-wrap justify-between items-stretch sm:items-center gap-3">
              <Link href={`/admin/users/${u.id}`} className="hover:opacity-80 transition-opacity min-w-0 flex-1">
                <p className="font-medium">{displayName(u)}</p>
                <p className="text-sm text-muted-foreground truncate">{u.email || '—'}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Badge variant="secondary">{ROLE_LABELS[u.role] ?? u.role}</Badge>
                  {u.email?.startsWith('telegram_') && <Badge variant="outline">Telegram</Badge>}
                  {u.isBlocked && <Badge variant="destructive">Bloklangan</Badge>}
                </div>
              </Link>
              <div className="flex flex-wrap items-center gap-2 min-h-[44px]">
                <Button size="sm" variant="outline" className="min-h-[40px] touch-manipulation" asChild>
                  <Link href={`/admin/users/${u.id}`}><User className="h-4 w-4 mr-1" /> Profil</Link>
                </Button>
                <select
                  className="rounded-lg border border-input bg-background h-10 min-h-[40px] px-3 text-sm touch-manipulation"
                  value={u.role}
                  onChange={(e) => setRole(u.id, e.target.value)}
                  disabled={u.isBlocked}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <Button size="sm" variant={u.isBlocked ? 'default' : 'outline'} className={cn('min-h-[40px] touch-manipulation', u.isBlocked ? '' : 'text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground')} onClick={() => block(u.id, !u.isBlocked)}>
                  {u.isBlocked ? 'Ochish' : 'Bloklash'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
