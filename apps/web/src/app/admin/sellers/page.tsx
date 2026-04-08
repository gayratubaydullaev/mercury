'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { Store, Percent } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardPanel } from '@/components/dashboard/dashboard-panel';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Seller = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isBlocked: boolean;
  shop: { id: string; name: string; slug: string; commissionRate?: number | null } | null;
  productsCount: number;
  ordersCount: number;
  totalRevenue: string;
};

export default function AdminSellersPage() {
  const [data, setData] = useState<{ data: Seller[]; total: number } | null>(null);
  const [loadError, setLoadError] = useState('');
  const [commissionModal, setCommissionModal] = useState<{ open: boolean; seller: Seller | null }>({ open: false, seller: null });
  const [commissionValue, setCommissionValue] = useState('');
  const [commissionSubmitting, setCommissionSubmitting] = useState(false);
  const [commissionError, setCommissionError] = useState('');
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const fetchSellers = useCallback(() => {
    if (!token) return;
    setLoadError('');
    apiFetch(`${API_URL}/admin/sellers?limit=50`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoadError(''); })
      .catch(() => { setData({ data: [], total: 0 }); setLoadError('API ga ulanishda xatolik.'); });
  }, [token]);

  useEffect(() => {
    fetchSellers();
  }, [fetchSellers]);

  const openCommissionModal = (seller: Seller) => {
    setCommissionModal({ open: true, seller });
    const rate = seller.shop?.commissionRate;
    setCommissionValue(rate != null && rate !== undefined ? String(rate) : '');
    setCommissionError('');
  };

  const closeCommissionModal = () => {
    setCommissionModal({ open: false, seller: null });
    setCommissionSubmitting(false);
    setCommissionError('');
  };

  const submitCommission = () => {
    const seller = commissionModal.seller;
    if (!seller || !token) return;
    const trimmed = commissionValue.trim();
    const value = trimmed === '' ? null : parseFloat(trimmed.replace(/,/g, '.'));
    if (trimmed !== '' && (value == null || Number.isNaN(value) || value < 0 || value > 100)) {
      setCommissionError('0–100 orasida kiriting yoki boʻsh qoldiring (platforma %)');
      return;
    }
    setCommissionSubmitting(true);
    setCommissionError('');
    apiFetch(`${API_URL}/admin/sellers/${seller.id}/commission`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ commissionRate: value }),
    })
      .then(() => {
        closeCommissionModal();
        fetchSellers();
        toast.success('Komissiya saqlandi');
      })
      .catch(() => {
        setCommissionError('Saqlashda xatolik');
        setCommissionSubmitting(false);
        toast.error('Komissiya saqlanmadi');
      });
  };

  if (!token) return <DashboardAuthGate />;
  if (!data) return <Skeleton className="h-64 w-full" />;

  const sellers = Array.isArray(data?.data) ? data.data : [];

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      <DashboardPageHeader
        eyebrow="Platforma"
        title="Sotuvchilar"
        description="Doʻkonlar, komissiya foizi, tovarlar va buyurtmalar boʻyicha koʻrinish."
      />
      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      <DashboardPanel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border/80 bg-muted/40">
              <th className="text-left py-2 px-2 font-medium">F.I.O / Email</th>
              <th className="text-left py-2 px-2 font-medium">Doʻkon</th>
              <th className="text-right py-2 px-2 font-medium">Komissiya %</th>
              <th className="text-right py-2 px-2 font-medium">Tovarlar</th>
              <th className="text-right py-2 px-2 font-medium">Buyurtmalar</th>
              <th className="text-right py-2 px-2 font-medium">Daromad</th>
              <th className="text-left py-2 px-2 font-medium w-24"></th>
            </tr>
          </thead>
          <tbody>
            {sellers.map((s) => (
              <tr key={s.id} className="border-b hover:bg-muted/50">
                <td className="py-3 px-2">
                  <p className="font-medium">{s.firstName} {s.lastName}</p>
                  <p className="text-muted-foreground text-xs">{s.email}</p>
                  {s.isBlocked && <Badge variant="destructive" className="mt-1">Bloklangan</Badge>}
                </td>
                <td className="py-3 px-2">{s.shop ? s.shop.name : '—'}</td>
                <td className="py-3 px-2 text-right">
                  {s.shop?.commissionRate != null ? `${Number(s.shop.commissionRate)}%` : 'Platforma'}
                </td>
                <td className="py-3 px-2 text-right">{s.productsCount}</td>
                <td className="py-3 px-2 text-right">{s.ordersCount}</td>
                <td className="py-3 px-2 text-right font-medium">{formatPrice(Number(s.totalRevenue))} soʻm</td>
                <td className="py-3 px-2">
                  <Button variant="ghost" size="sm" onClick={() => openCommissionModal(s)} className="gap-1" title="Komissiyani oʻzgartirish">
                    <Percent className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {sellers.length === 0 && !loadError && (
          <div className="p-6">
            <DashboardEmptyState icon={Store} title="Sotuvchilar yoʻq" description="Hozircha roʻyxat boʻsh." />
          </div>
        )}
      </DashboardPanel>

      <Dialog open={commissionModal.open} onOpenChange={(open) => !open && closeCommissionModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Komissiya %</DialogTitle>
            <DialogDescription>
              {commissionModal.seller && (
                <>Sotuvchi: {commissionModal.seller.firstName} {commissionModal.seller.lastName}. Boʻsh qoldirsangiz, platforma foizi qoʻllanadi.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="commission-rate">Foiz (0–100 yoki boʻsh)</Label>
              <Input
                id="commission-rate"
                type="text"
                inputMode="decimal"
                placeholder="Platforma default"
                value={commissionValue}
                onChange={(e) => setCommissionValue(e.target.value)}
              />
            </div>
            {commissionError && <p className="text-sm text-destructive">{commissionError}</p>}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="min-h-[40px] touch-manipulation" onClick={closeCommissionModal} disabled={commissionSubmitting}>Bekor qilish</Button>
            <Button className="min-h-[40px] touch-manipulation" onClick={submitCommission} disabled={commissionSubmitting}>
              {commissionSubmitting ? 'Saqlanmoqda…' : 'Saqlash'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
