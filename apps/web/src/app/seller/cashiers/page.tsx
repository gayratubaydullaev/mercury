'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { ArrowLeft, Users, ScanLine, Mail, Trash2, UserPlus } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import { DashboardPanel } from '@/components/dashboard/dashboard-panel';

type CashierRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  createdAt?: string;
};

export default function SellerCashiersPage() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const [staff, setStaff] = useState<CashierRow[] | null>(null);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffSaving, setStaffSaving] = useState(false);
  const [cashierEmail, setCashierEmail] = useState('');
  const [cashierPassword, setCashierPassword] = useState('');
  const [cashierFirstName, setCashierFirstName] = useState('');
  const [cashierLastName, setCashierLastName] = useState('');
  const [cashierPhone, setCashierPhone] = useState('');
  const [removeTarget, setRemoveTarget] = useState<CashierRow | null>(null);
  const [removing, setRemoving] = useState(false);

  const loadStaff = useCallback(() => {
    if (!token) return;
    setStaffLoading(true);
    apiFetch(`${API_URL}/seller/staff`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((rows) => setStaff(Array.isArray(rows) ? rows : []))
      .catch(() => setStaff([]))
      .finally(() => setStaffLoading(false));
  }, [token]);

  useEffect(() => {
    if (token) loadStaff();
  }, [token, loadStaff]);

  const createCashier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setStaffSaving(true);
    apiFetch(`${API_URL}/seller/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        email: cashierEmail.trim().toLowerCase(),
        password: cashierPassword,
        firstName: cashierFirstName.trim(),
        lastName: cashierLastName.trim(),
        phone: cashierPhone.trim() || undefined,
      }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          const msg =
            typeof d?.message === 'string'
              ? d.message
              : Array.isArray(d?.message)
                ? d.message.map((x: { constraints?: Record<string, string> }) => Object.values(x.constraints ?? {}).join(' ')).join(' ')
                : 'Xatolik';
          throw new Error(msg);
        }
        return d;
      })
      .then(() => {
        toast.success('Kassir yaratildi');
        setCashierEmail('');
        setCashierPassword('');
        setCashierFirstName('');
        setCashierLastName('');
        setCashierPhone('');
        loadStaff();
      })
      .catch((err: Error) => toast.error(err?.message ?? 'Yaratilmadi'))
      .finally(() => setStaffSaving(false));
  };

  const confirmRemove = () => {
    if (!token || !removeTarget) return;
    setRemoving(true);
    apiFetch(`${API_URL}/seller/staff/${removeTarget.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(typeof d?.message === 'string' ? d.message : 'Xatolik');
        return d;
      })
      .then(() => {
        toast.success('Kassir doʻkondan olib tashlandi');
        setRemoveTarget(null);
        loadStaff();
      })
      .catch((err: Error) => toast.error(err?.message ?? 'Xatolik'))
      .finally(() => setRemoving(false));
  };

  if (!token) return <DashboardAuthGate />;

  return (
    <div className="w-full min-w-0 max-w-4xl space-y-6 pb-10">
      <DashboardPageHeader
        eyebrow="Sotuvchi kabineti"
        title="Kassirlar"
        description="Cheklangan kirish: faqat sizning doʻkoningiz tovarlari, POS va buyurtmalar. Kassirlar alohida hisob bilan /cashier/pos sahifasiga kiradi."
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="min-h-[40px] touch-manipulation" asChild>
            <Link href="/seller/settings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Sozlamalar
            </Link>
          </Button>
          <Button size="sm" className="min-h-[40px] touch-manipulation gap-2" asChild>
            <Link href="/seller/pos">
              <ScanLine className="h-4 w-4" />
              POS kassa
            </Link>
          </Button>
        </div>
      </DashboardPageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,360px)] lg:items-start">
        <DashboardPanel className="order-2 lg:order-1">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
            <Users className="h-5 w-5 text-primary" aria-hidden />
            Roʻyxat
          </div>
          {staffLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : !staff?.length ? (
            <DashboardEmptyState
              icon={Users}
              title="Hozircha kassir yoʻq"
              description="Yangi kassir yarating — ular faqat kassa va doʻkon buyurtmalarini koʻradi, toʻliq sotuvchi paneliga kira olmaydi."
            />
          ) : (
            <ul className="space-y-3">
              {staff.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {(c.firstName?.[0] ?? '?').toUpperCase()}
                      {(c.lastName?.[0] ?? '').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium leading-tight">
                        {c.firstName} {c.lastName}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{c.email}</span>
                      </p>
                      {c.phone ? <p className="mt-0.5 text-xs text-muted-foreground">{c.phone}</p> : null}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setRemoveTarget(c)}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Oʻchirish
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DashboardPanel>

        <Card className="order-1 border-primary/15 bg-gradient-to-b from-primary/[0.06] to-card lg:order-2 lg:sticky lg:top-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="h-5 w-5 text-primary" />
              Yangi kassir
            </CardTitle>
            <p className="text-sm text-muted-foreground font-normal">
              Email va parol bilan yangi hisob. Kirish:{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/cashier/pos</code>
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={createCashier} className="space-y-3">
              <div>
                <Label htmlFor="nc-email">Email</Label>
                <Input
                  id="nc-email"
                  type="email"
                  className="mt-1"
                  value={cashierEmail}
                  onChange={(e) => setCashierEmail(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>
              <div>
                <Label htmlFor="nc-pass">Parol (min. 8)</Label>
                <Input
                  id="nc-pass"
                  type="password"
                  className="mt-1"
                  value={cashierPassword}
                  onChange={(e) => setCashierPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="nc-fn">Ism</Label>
                  <Input id="nc-fn" className="mt-1" value={cashierFirstName} onChange={(e) => setCashierFirstName(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="nc-ln">Familiya</Label>
                  <Input id="nc-ln" className="mt-1" value={cashierLastName} onChange={(e) => setCashierLastName(e.target.value)} required />
                </div>
              </div>
              <div>
                <Label htmlFor="nc-phone">Telefon (ixtiyoriy)</Label>
                <Input
                  id="nc-phone"
                  className="mt-1"
                  value={cashierPhone}
                  onChange={(e) => setCashierPhone(e.target.value)}
                  placeholder="+998..."
                />
              </div>
              <Button type="submit" className="w-full min-h-[44px]" disabled={staffSaving}>
                {staffSaving ? 'Yaratilmoqda...' : 'Kassir qoʻshish'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kassirni olib tashlash?</DialogTitle>
            <DialogDescription>
              {removeTarget ? (
                <>
                  <strong>
                    {removeTarget.firstName} {removeTarget.lastName}
                  </strong>{' '}
                  ({removeTarget.email}) oddiy xaridor roliga oʻtadi va doʻkon kassirlaridan chiqariladi.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setRemoveTarget(null)} disabled={removing}>
              Bekor
            </Button>
            <Button type="button" variant="destructive" onClick={confirmRemove} disabled={removing}>
              {removing ? 'Jarayon...' : 'Ha, olib tashlash'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
