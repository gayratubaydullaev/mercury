'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { Banknote, PlusCircle } from 'lucide-react';
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

  if (!token) return <p>Kirish kerak</p>;
  if (!data) return <Skeleton className="h-64 w-full" />;

  const rows = Array.isArray(data?.data) ? data.data : [];

  return (
    <div className="min-w-0 max-w-full">
      <h1 className="text-xl sm:text-2xl font-bold mb-2 flex flex-wrap items-center gap-2">
        <Banknote className="h-6 w-6 sm:h-7 sm:w-7 shrink-0" />
        Toʻlovlar
      </h1>
      <p className="text-muted-foreground mb-4 sm:mb-6 text-sm sm:text-base">Sotuvchilar boʻyicha toʻlangan buyurtmalar, komissiya va qoldiq</p>
      {loadError && <p className="text-destructive text-sm mb-4">{loadError}</p>}
      <div className="overflow-x-auto -mx-0 rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm border-collapse min-w-[560px]">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-2 font-medium">Sotuvchi</th>
              <th className="text-right py-2 px-2 font-medium">Buyurtmalar</th>
              <th className="text-right py-2 px-2 font-medium">Jami</th>
              <th className="text-right py-2 px-2 font-medium">Komissiya</th>
              <th className="text-right py-2 px-2 font-medium">Toʻlangan</th>
              <th className="text-right py-2 px-2 font-medium">Qoldiq</th>
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
                <td className="py-3 px-2 text-right">{formatPrice(row.commission)} soʻm</td>
                <td className="py-3 px-2 text-right">{formatPrice(row.totalPaid)} soʻm</td>
                <td className="py-3 px-2 text-right font-medium">{formatPrice(row.balance)} soʻm</td>
                <td className="py-3 px-2 text-right">
                  <Button variant="outline" size="sm" className="min-h-[40px] touch-manipulation" onClick={() => openRecordModal(row)}>
                    <PlusCircle className="h-4 w-4" />
                    Toʻlov
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && !loadError && <p className="text-muted-foreground py-8">Maʼlumot yoʻq</p>}

      <Dialog open={recordModal.open} onOpenChange={(open) => !open && closeRecordModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Toʻlov qabul qilindi</DialogTitle>
            <DialogDescription>
              {recordModal.row && (
                <>Sotuvchidan olingan toʻlovni kiriting: {recordModal.row.seller.firstName} {recordModal.row.seller.lastName}</>
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
