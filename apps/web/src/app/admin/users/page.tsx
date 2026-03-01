'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/utils';
import { apiFetch, apiGetJson } from '@/lib/api';
import { isApiError } from '@/types/api';
import { User } from 'lucide-react';

const ROLES = ['BUYER', 'SELLER', 'ADMIN'] as const;
const ROLE_LABELS: Record<string, string> = { BUYER: 'Xaridor', SELLER: 'Sotuvchi', ADMIN: 'Admin' };

interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isBlocked: boolean;
}

interface AdminUsersResponse {
  data: AdminUser[];
  message?: string;
}

export default function AdminUsersPage() {
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('');
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const load = () => {
    if (!token) return;
    const q = roleFilter ? `?role=${roleFilter}` : '';
    apiGetJson<AdminUsersResponse>(`${API_URL}/admin/users${q}`, { headers: { Authorization: `Bearer ${token}` } }).then(setData).catch(() => setData(null));
  };

  useEffect(() => {
    load();
  }, [token, roleFilter]);

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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Foydalanuvchilar</h1>
      <p className="text-muted-foreground mb-4">Koʻrish, bloklash va rol berish</p>
      <div className="flex flex-wrap gap-2 mb-4">
        <Button variant={roleFilter === '' ? 'default' : 'outline'} size="sm" onClick={() => setRoleFilter('')}>Barchasi</Button>
        {ROLES.map((r) => (
          <Button key={r} variant={roleFilter === r ? 'default' : 'outline'} size="sm" onClick={() => setRoleFilter(r)}>{ROLE_LABELS[r]}</Button>
        ))}
      </div>
      {users.length === 0 && isApiError(data) && data.message && (
        <p className="text-destructive text-sm mb-4">{data.message}</p>
      )}
      <div className="space-y-3 max-w-3xl">
        {users.map((u) => (
          <Card key={u.id}>
            <CardContent className="p-4 flex flex-wrap justify-between items-center gap-3">
              <Link href={`/admin/users/${u.id}`} className="hover:opacity-80 transition-opacity min-w-0">
                <p className="font-medium">{u.firstName} {u.lastName}</p>
                <p className="text-sm text-muted-foreground">{u.email}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Badge variant="secondary">{ROLE_LABELS[u.role] ?? u.role}</Badge>
                  {u.isBlocked && <Badge variant="destructive">Bloklangan</Badge>}
                </div>
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/admin/users/${u.id}`}><User className="h-4 w-4 mr-1" /> Profil</Link>
                </Button>
                <select
                  className="rounded-md border px-2 py-1 text-sm"
                  value={u.role}
                  onChange={(e) => setRole(u.id, e.target.value)}
                  disabled={u.isBlocked}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <Button size="sm" variant={u.isBlocked ? 'default' : 'outline'} className={u.isBlocked ? '' : 'text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground'} onClick={() => block(u.id, !u.isBlocked)}>
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
