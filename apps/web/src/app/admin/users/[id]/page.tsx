'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { ArrowLeft, User, Mail, Phone, Store, Package, ShoppingBag, Banknote, Calendar } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = { BUYER: 'Xaridor', SELLER: 'Sotuvchi', ADMIN: 'Admin' };

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
  createdAt: string;
  updatedAt: string;
  shop?: { id: string; name: string; slug: string; description: string | null; isActive: boolean } | null;
  productsCount?: number;
  ordersCount?: number;
  totalRevenue?: string;
};

export default function AdminUserProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const [user, setUser] = useState<UserProfile | null | undefined>(undefined);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

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
      .then(() => setUser((u) => (u ? { ...u, isBlocked: block } : u)));
  };

  const setRole = (role: string) => {
    if (!token || !user) return;
    apiFetch(`${API_URL}/admin/users/${user.id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role }),
    })
      .then(() => setUser((u) => (u ? { ...u, role } : u)));
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
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/users"><ArrowLeft className="h-4 w-4 mr-1" /> Foydalanuvchilar</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profil
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="secondary">{ROLE_LABELS[user.role] ?? user.role}</Badge>
            {user.isBlocked && <Badge variant="destructive">Bloklangan</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <p className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Email:</span> {user.email}
            </p>
            {user.phone && (
              <p className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Tel:</span> {user.phone}
              </p>
            )}
            <p className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Roʻyxatdan:</span> {new Date(user.createdAt).toLocaleDateString('uz-UZ')}
            </p>
            {user.emailVerified !== undefined && (
              <p className="text-sm"><span className="text-muted-foreground">Email tasdiqlangan:</span> {user.emailVerified ? 'Ha' : 'Yoʻq'}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <select
              className="rounded-md border px-2 py-1.5 text-sm"
              value={user.role}
              onChange={(e) => setRole(e.target.value)}
              disabled={user.isBlocked}
            >
              <option value="BUYER">{ROLE_LABELS.BUYER}</option>
              <option value="SELLER">{ROLE_LABELS.SELLER}</option>
              <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
            </select>
            <Button size="sm" variant={user.isBlocked ? 'default' : 'outline'} className={user.isBlocked ? '' : 'text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground'} onClick={() => block(!user.isBlocked)}>
              {user.isBlocked ? 'Blokdan chiqarish' : 'Bloklash'}
            </Button>
          </div>
        </CardContent>
      </Card>

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
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{user.productsCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Tovarlar</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{user.ordersCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Buyurtmalar (toʻlangan)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{formatPrice(Number(user.totalRevenue ?? 0))}</p>
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
