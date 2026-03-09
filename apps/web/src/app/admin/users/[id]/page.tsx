'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, cn, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { ArrowLeft, User, Mail, Phone, Store, Package, ShoppingBag, Banknote, Calendar } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  BUYER: 'Xaridor',
  SELLER: 'Sotuvchi',
  ADMIN: 'Bosh admin',
  ADMIN_MODERATOR: 'Moderator',
};

type ModeratorPermissions = {
  canModerateProducts?: boolean;
  canModerateReviews?: boolean;
  canApproveSellerApplications?: boolean;
  canApproveShopUpdates?: boolean;
};

type UserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  isBlocked: boolean;
  emailVerified: boolean;
  avatarUrl: string | null;
  moderatorPermissions?: ModeratorPermissions | null;
  createdAt: string;
  updatedAt: string;
  shop?: { id: string; name: string; slug: string; description: string | null; isActive: boolean } | null;
  productsCount?: number;
  ordersCount?: number;
  totalRevenue?: string;
};

const MODERATOR_PERMISSION_OPTIONS: { key: keyof ModeratorPermissions; label: string }[] = [
  { key: 'canModerateProducts', label: 'Tovarlarni moderatsiya qilish' },
  { key: 'canModerateReviews', label: 'Sharhlarni moderatsiya qilish' },
  { key: 'canApproveSellerApplications', label: 'Sotuvchi arizalarini tasdiqlash' },
  { key: 'canApproveShopUpdates', label: 'Doʻkon oʻzgarishlarini tasdiqlash' },
];

export default function AdminUserProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const [user, setUser] = useState<UserProfile | null | undefined>(undefined);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [permissionSaving, setPermissionSaving] = useState<keyof ModeratorPermissions | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const isSuperAdmin = currentUserRole === 'ADMIN';

  useEffect(() => {
    if (!token) return;
    apiFetch(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((me: { role?: string }) => setCurrentUserRole(me?.role ?? null))
      .catch(() => setCurrentUserRole(null));
  }, [token]);
  useEffect(() => {
    if (!token || !id) return;
    apiFetch(`${API_URL}/admin/users/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Not found'))))
      .then(setUser)
      .catch(() => setUser(null));
  }, [token, id]);

  const block = (block: boolean) => {
    if (!token || !user) return;
    apiFetch(`${API_URL}/admin/users/${user.id}/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ block }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({})) as { message?: string };
          throw new Error(body?.message ?? 'Amal bajarilmadi');
        }
        setUser((u) => (u ? { ...u, isBlocked: block } : u));
      })
      .catch((err: Error) => toast.error(err.message ?? 'Amal bajarilmadi'));
  };

  const setRole = (role: string) => {
    if (!token || !user) return;
    apiFetch(`${API_URL}/admin/users/${user.id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({})) as { message?: string };
          throw new Error(body?.message ?? 'Rol saqlanmadi');
        }
        setUser((u) => (u ? { ...u, role } : u));
      })
      .catch((err: Error) => toast.error(err.message ?? 'Rol saqlanmadi'));
  };

  const setModeratorPermission = (key: keyof ModeratorPermissions, value: boolean) => {
    if (!token || !user || user.role !== 'ADMIN_MODERATOR') return;
    setPermissionSaving(key);
    apiFetch(`${API_URL}/admin/users/${user.id}/moderator-permissions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ [key]: value }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({})) as { message?: string };
          throw new Error(body?.message ?? 'Saqlanmadi');
        }
        setUser((u) => (u ? { ...u, moderatorPermissions: { ...u.moderatorPermissions, [key]: value } } : u));
        toast.success('Huquqlar yangilandi');
      })
      .catch((err: Error) => toast.error(err.message ?? 'Saqlanmadi'))
      .finally(() => setPermissionSaving(null));
  };

  if (!token) return <p>Kirish kerak</p>;
  if (user === undefined) return <Skeleton className="h-64 w-full" />;
  if (user === null) {
    return (
      <div>
        <Button variant="ghost" size="sm" asChild><Link href="/admin/users"><ArrowLeft className="h-4 w-4 mr-1" /> Orqaga</Link></Button>
        <p className="mt-4 text-destructive">Foydalanuvchi topilmadi.</p>
      </div>
    );
  }

  const isSeller = user.role === 'SELLER';

  return (
    <div className="space-y-6 max-w-2xl min-w-0">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="min-h-[40px] touch-manipulation" asChild>
          <Link href="/admin/users"><ArrowLeft className="h-4 w-4 mr-1" /> Foydalanuvchilar</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <User className="h-5 w-5 shrink-0" />
            Profil
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary">{ROLE_LABELS[user.role] ?? user.role}</Badge>
            {user.isBlocked && <Badge variant="destructive">Bloklangan</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <p className="flex items-center gap-2 text-sm break-words min-w-0">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground shrink-0">Email:</span> <span className="truncate">{user.email}</span>
            </p>
            {user.phone && (
              <p className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Tel:</span> {user.phone}
              </p>
            )}
            <p className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Roʻyxatdan:</span> {new Date(user.createdAt).toLocaleDateString('uz-UZ')}
            </p>
            {user.emailVerified !== undefined && (
              <p className="text-sm"><span className="text-muted-foreground">Email tasdiqlangan:</span> {user.emailVerified ? 'Ha' : 'Yoʻq'}</p>
            )}
          </div>
          {isSuperAdmin && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <select
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[40px] touch-manipulation"
                value={user.role}
                onChange={(e) => setRole(e.target.value)}
                disabled={user.isBlocked}
              >
                <option value="BUYER">{ROLE_LABELS.BUYER}</option>
                <option value="SELLER">{ROLE_LABELS.SELLER}</option>
                <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
                <option value="ADMIN_MODERATOR">{ROLE_LABELS.ADMIN_MODERATOR}</option>
              </select>
              <Button size="sm" className={`min-h-[40px] touch-manipulation ${!user.isBlocked ? 'text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground' : ''}`} variant={user.isBlocked ? 'default' : 'outline'} onClick={() => block(!user.isBlocked)}>
                {user.isBlocked ? 'Blokdan chiqarish' : 'Bloklash'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {user.role === 'ADMIN_MODERATOR' && isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Moderator huquqlari</CardTitle>
            <p className="text-sm text-muted-foreground font-normal">Ushbu moderator qaysi amallarni bajarishi mumkin. Barcha ruxsatlar ochiq bo‘lsa — to‘liq huquq (tovarlar, sharhlar, arizalar, do‘kon o‘zgarishlari).</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {MODERATOR_PERMISSION_OPTIONS.map(({ key, label }) => (
              <label key={key} className={cn('flex items-center gap-3', permissionSaving ? 'opacity-70' : 'cursor-pointer')}>
                <input
                  type="checkbox"
                  checked={user.moderatorPermissions?.[key] !== false}
                  disabled={permissionSaving !== null}
                  onChange={(e) => setModeratorPermission(key, e.target.checked)}
                  className="rounded border-input h-4 w-4"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </CardContent>
        </Card>
      )}

      {isSeller && user.shop && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Doʻkon
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p><span className="text-muted-foreground">Nomi:</span> {user.shop.name}</p>
            <p><span className="text-muted-foreground">Slug:</span> {user.shop.slug}</p>
            {user.shop.description && <p><span className="text-muted-foreground">Tavsif:</span> {user.shop.description}</p>}
            <p><span className="text-muted-foreground">Holat:</span> {user.shop.isActive ? 'Aktiv' : 'Nofaol'}</p>
          </CardContent>
        </Card>
      )}

      {isSeller && (user.productsCount !== undefined || user.ordersCount !== undefined) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">Statistika</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40">
                <Package className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold">{user.productsCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Tovarlar</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40">
                <ShoppingBag className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold">{user.ordersCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Buyurtmalar</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40">
                <Banknote className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold break-words">{formatPrice(Number(user.totalRevenue ?? 0))}</p>
                  <p className="text-xs text-muted-foreground">Daromad (soʻm)</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
