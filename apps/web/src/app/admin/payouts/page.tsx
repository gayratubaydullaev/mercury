'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { Banknote, PlusCircle } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type PayoutRow = {
  seller: { id: string; firstName: string; lastName: string; email: string };
  total: number;
  commission: number;
  ordersCount: number;
  totalPaid: number;
  balance: number;
};

export default function AdminPayoutsPage() {
  const [data, setData] = useState<{ data: PayoutRow[]; total: number } | null>(null);
  const [loadError, setLoadError] = useState('');
  const [recordModal, setRecordModal] = useState<{ open: boolean; row: PayoutRow | null }>({ open: false, row: null });
  const [recordAmount, setRecordAmount] = useState('');
  const [recordMethod, setRecordMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [recordPaidAt, setRecordPaidAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [recordNote, setRecordNote] = useState('');
  const [recordSubmitting, setRecordSubmitting] = useState(false);
  const [recordError, setRecordError] = useState('');
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const fetchPayouts = useCallback(() => {
    if (!token) return;
    setLoadError('');
    apiFetch(`${API_URL}/admin/payouts?limit=100`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoadError('');
      })
      .catch(() => {
        setData({ data: [], total: 0 });
        setLoadError('API ga ulanishda xatolik.');
      });
  }, [token]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  const openRecordModal = (row: PayoutRow) => {
    setRecordModal({ open: true, row });
    setRecordAmount('');
    setRecordMethod('CASH');
    setRecordPaidAt(new Date().toISOString().slice(0, 16));
    setRecordNote('');
    setRecordError('');
  };

  const closeRecordModal = () => {
    setRecordModal({ open: false, row: null });
    setRecordSubmitting(false);
    setRecordError('');
  };

  const submitRecordPayout = () => {
    const row = recordModal.row;
    if (!row || !token) return;
    const amount = parseFloat(recordAmount.replace(/,/g, '.'));
    if (Number.isNaN(amount) || amount <= 0) {
      setRecordError('Summani kiriting');
      return;
    }
    setRecordSubmitting(true);
    setRecordError('');
    apiFetch(`${API_URL}/admin/payouts/record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        sellerId: row.seller.id,
        amount,
        method: recordMethod,
        paidAt: recordPaidAt ? new Date(recordPaidAt).toISOString() : undefined,
        note: recordNote || undefined,
      }),
    })
      .then(() => {
        closeRecordModal();
        fetchPayouts();
        toast.success('Toʻlov qayd etildi');
      })
      .catch(() => {
        setRecordError('Toʻlovni saqlashda xatolik');
        setRecordSubmitting(false);
        toast.error('Toʻlov saqlanmadi');
      });
  };

  if (!token) return <DashboardAuthGate />;
  if (!data) return <Skeleton className="h-64 w-full" />;

  const rows = Array.isArray(data?.data) ? data.data : [];

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      <DashboardPageHeader
        eyebrow="Platforma"
        title="Komissiya hisobi"
        description="Sotuvchilardan komissiya qabul qilish va qoldiqni kuzatish."
      />
      <div className="max-w-2xl rounded-lg border border-border bg-muted/50 p-4">
        <p className="text-sm font-medium mb-1">Qanday ishlaydi</p>
        <ul className="text-xs sm:text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li><strong className="text-foreground">Savdolar</strong> — toʻlangan buyurtmalar boʻyicha jami summa (sotuvchi oladi).</li>
          <li><strong className="text-foreground">Bizning komissiyamiz</strong> — platforma ulushi (foiz savdolardan).</li>
          <li>Sotuvchi komissiyani bizga naqd yoki karta orqali toʻlaydi. Siz «Qayd etish» tugmasi orqali sotuvchidan qabul qilingan summani (naqd/karta) kiritasiz.</li>
          <li><strong className="text-foreground">Qoldiq</strong> — sotuvchi qancha toʻlashi kerak (yoki ortiqcha toʻlangan boʻlsa — uning hisobida).</li>
        </ul>
      </div>
      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      <DashboardPanel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left py-2 px-2 font-medium">Sotuvchi</th>
              <th className="text-right py-2 px-2 font-medium" title="Toʻlangan buyurtmalar soni">Buyurtmalar</th>
              <th className="text-right py-2 px-2 font-medium" title="Savdolar jami">Savdolar</th>
              <th className="text-right py-2 px-2 font-medium" title="Sotuvchiga tegishli (savdo − komissiya)">Sotuvchi oladi</th>
              <th className="text-right py-2 px-2 font-medium" title="Platforma ulushi">Bizning komissiya</th>
              <th className="text-right py-2 px-2 font-medium" title="Sotuvchi bizga allaqachon toʻlagan">Bizga toʻlangan</th>
              <th className="text-right py-2 px-2 font-medium" title="Qolgan qarz yoki sotuvchi hisobida">Qoldiq</th>
              <th className="text-right py-2 px-2 font-medium w-32" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.seller?.id ?? i} className="border-b hover:bg-muted/50">
                <td className="py-3 px-2">
                  <p className="font-medium">{row.seller?.firstName} {row.seller?.lastName}</p>
                  <p className="text-muted-foreground text-xs">{row.seller?.email}</p>
                </td>
                <td className="py-3 px-2 text-right">{row.ordersCount}</td>
                <td className="py-3 px-2 text-right">{formatPrice(row.total)} soʻm</td>
                <td className="py-3 px-2 text-right">{formatPrice(row.total - row.commission)} soʻm</td>
                <td className="py-3 px-2 text-right">{formatPrice(row.commission)} soʻm</td>
                <td className="py-3 px-2 text-right">{formatPrice(row.totalPaid)} soʻm</td>
                <td className="py-3 px-2 text-right font-medium">
                  {row.balance === 0 ? (
                    <span className="text-muted-foreground">Toʻlandi</span>
                  ) : row.balance < 0 ? (
                    <span className="text-green-600 dark:text-green-400" title="Sotuvchi hisobida (ortiqcha toʻlov)">
                      +{formatPrice(-row.balance)} soʻm
                    </span>
                  ) : (
                    <span>{formatPrice(row.balance)} soʻm</span>
                  )}
                </td>
                <td className="py-3 px-2 text-right">
                  <Button variant="outline" size="sm" className="min-h-[40px] touch-manipulation" onClick={() => openRecordModal(row)}>
                    <PlusCircle className="h-4 w-4" />
                    Qayd etish
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t-2 bg-muted/40 font-medium">
              <tr>
                <td className="py-3 px-2" colSpan={2}>Jami</td>
                <td className="py-3 px-2 text-right">{formatPrice(rows.reduce((s, r) => s + r.total, 0))} soʻm</td>
                <td className="py-3 px-2 text-right">{formatPrice(rows.reduce((s, r) => s + (r.total - r.commission), 0))} soʻm</td>
                <td className="py-3 px-2 text-right">{formatPrice(rows.reduce((s, r) => s + r.commission, 0))} soʻm</td>
                <td className="py-3 px-2 text-right">{formatPrice(rows.reduce((s, r) => s + r.totalPaid, 0))} soʻm</td>
                <td className="py-3 px-2 text-right">{formatPrice(rows.reduce((s, r) => s + r.balance, 0))} soʻm</td>
                <td className="py-3 px-2" />
              </tr>
            </tfoot>
          )}
        </table>
        </div>
        {rows.length === 0 && !loadError && (
          <div className="p-6">
            <DashboardEmptyState icon={Banknote} title="Maʼlumot yoʻq" description="Sotuvchilar boʻyicha komissiya jadvali hozircha boʻsh." />
          </div>
        )}
      </DashboardPanel>
      {rows.length > 0 && (
        <p className="text-xs text-muted-foreground sm:text-sm">
          <strong>Qoldiq</strong> — sotuvchilar platformaga qancha toʻlashi kerak (yoki manfiy boʻlsa, sotuvchilar hisobida ortiqcha).
        </p>
      )}

      <Dialog open={recordModal.open} onOpenChange={(open) => !open && closeRecordModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Komissiya qabul qilindi</DialogTitle>
            <DialogDescription>
              {recordModal.row && (
                <>Sotuvchi sizga naqd yoki karta orqali komissiya toʻladi — shu summani kiriting. Qoldiq shuncha kamayadi. Ortiqcha toʻlsa, sotuvchi hisobiga yoziladi. {recordModal.row.seller.firstName} {recordModal.row.seller.lastName}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="record-amount">Summa (soʻm)</Label>
              <Input
                id="record-amount"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={recordAmount}
                onChange={(e) => setRecordAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="record-method">Toʻlov usuli</Label>
              <select
                id="record-method"
                className="flex h-10 min-h-[40px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                value={recordMethod}
                onChange={(e) => setRecordMethod(e.target.value as 'CASH' | 'CARD')}
              >
                <option value="CASH">Naqd</option>
                <option value="CARD">Karta</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="record-paidAt">Sana</Label>
              <Input
                id="record-paidAt"
                type="datetime-local"
                value={recordPaidAt}
                onChange={(e) => setRecordPaidAt(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="record-note">Izoh (ixtiyoriy)</Label>
              <Input
                id="record-note"
                value={recordNote}
                onChange={(e) => setRecordNote(e.target.value)}
                placeholder="Masalan: naqd toʻlov"
              />
            </div>
            {recordError && <p className="text-sm text-destructive">{recordError}</p>}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="min-h-[40px] touch-manipulation" onClick={closeRecordModal} disabled={recordSubmitting}>Bekor qilish</Button>
            <Button className="min-h-[40px] touch-manipulation" onClick={submitRecordPayout} disabled={recordSubmitting}>
              {recordSubmitting ? 'Saqlanmoqda…' : 'Saqlash'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
