'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_URL, cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { Loader2, RotateCcw } from 'lucide-react';
import type { OrderDetailData } from '@/components/dashboard/order-detail-content';

type LineState = Record<string, string>;

export function SellerOrderReturnPanel({
  orderId,
  token,
  order,
  onSuccess,
}: {
  orderId: string;
  token: string;
  order: OrderDetailData;
  onSuccess: (next: OrderDetailData) => void;
}) {
  const [note, setNote] = useState('');
  const [qtyByItem, setQtyByItem] = useState<LineState>({});
  const [submitting, setSubmitting] = useState(false);

  const lines = useMemo(() => {
    if (!Array.isArray(order.items)) return [];
    return order.items
      .filter((it) => it.id)
      .map((it) => {
        const sold = it.quantity;
        const ret = it.returnedQuantity ?? 0;
        const remaining = sold - ret;
        return {
          id: it.id as string,
          title: it.product?.title ?? '—',
          sold,
          returned: ret,
          remaining,
        };
      });
  }, [order.items]);

  const canReturnAny = lines.some((l) => l.remaining > 0);
  const isCancelled = order.status === 'CANCELLED';
  const stockOut = Boolean(order.stockDeductedAt);

  const submitPartial = async () => {
    const items: { orderItemId: string; quantity: number }[] = [];
    for (const l of lines) {
      if (l.remaining <= 0) continue;
      const raw = (qtyByItem[l.id] ?? '').trim();
      if (!raw) continue;
      const n = parseInt(raw, 10);
      if (!Number.isFinite(n) || n < 1) {
        toast.error('Miqdor butun son boʻlishi kerak (≥ 1)');
        return;
      }
      if (n > l.remaining) {
        toast.error(`«${l.title}»: maksimum ${l.remaining} ta`);
        return;
      }
      items.push({ orderItemId: l.id, quantity: n });
    }
    if (items.length === 0) {
      toast.message('Qaytarish miqdorini kiriting yoki «Butun chek» ni bosing');
      return;
    }
    setSubmitting(true);
    try {
      const r = await apiFetch(`${API_URL}/orders/${orderId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items, note: note.trim() || undefined }),
      });
      const data = (await r.json()) as OrderDetailData & { message?: string };
      if (!r.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Xatolik');
      toast.success('Qaytaruv qayd etildi, ombor yangilandi');
      onSuccess(data as OrderDetailData);
      setQtyByItem({});
      setNote('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Qaytaruv amalga oshmadi');
    } finally {
      setSubmitting(false);
    }
  };

  const submitFull = async () => {
    if (!canReturnAny) return;
    if (typeof window !== 'undefined' && !window.confirm('Butun chek boʻyicha qolgan barcha mahsulotlar qaytarilsinmi?')) {
      return;
    }
    setSubmitting(true);
    try {
      const r = await apiFetch(`${API_URL}/orders/${orderId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fullOrder: true, note: note.trim() || undefined }),
      });
      const data = (await r.json()) as OrderDetailData & { message?: string };
      if (!r.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Xatolik');
      toast.success('Butun chek qaytarildi');
      onSuccess(data as OrderDetailData);
      setQtyByItem({});
      setNote('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Qaytaruv amalga oshmadi');
    } finally {
      setSubmitting(false);
    }
  };

  if (!stockOut) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
        Qaytaruv faqat ombordan chiqarilgan cheklar uchun: avval POS yoki checkout orqali buyurtmani rasmiylashtiring (ombor yechilgach bu yerda ochiladi).
      </div>
    );
  }

  if (isCancelled || !canReturnAny) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
        {isCancelled
          ? 'Bekor qilingan buyurtmada qaytaruv yoʻq.'
          : 'Bu chek boʻyicha qaytarish mumkin boʻlgan mahsulot qolmagan.'}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 dark:bg-amber-500/10">
      <div className="flex items-start gap-2">
        <RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
        <div>
          <h3 className="text-sm font-semibold text-foreground">Qaytaruv (faqat sotuvchi)</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Kassalar bu boʻlimni koʻrmaydi. Qaytarilgan dona omborga qaytadi. Toʻliq qaytaruvda toʻlov holati «Qaytarilgan» boʻladi.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {lines.map((l) =>
          l.remaining > 0 ? (
            <div key={l.id} className="flex flex-wrap items-end gap-2 sm:items-center">
              <div className="min-w-0 flex-1">
                <Label className="text-xs text-muted-foreground">{l.title}</Label>
                <p className="text-[11px] text-muted-foreground">
                  Sotilgan: {l.sold} · Qaytarilgan: {l.returned} · Qoldiq: {l.remaining}
                </p>
              </div>
              <div className="w-24">
                <Label htmlFor={`ret-${l.id}`} className="sr-only">
                  Qaytarish
                </Label>
                <Input
                  id={`ret-${l.id}`}
                  inputMode="numeric"
                  placeholder="0"
                  value={qtyByItem[l.id] ?? ''}
                  onChange={(e) => setQtyByItem((s) => ({ ...s, [l.id]: e.target.value }))}
                  className="h-9"
                />
              </div>
            </div>
          ) : null
        )}
      </div>

      <div>
        <Label htmlFor="return-note">Izoh (ixtiyoriy)</Label>
        <textarea
          id="return-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Sababi, naqd qaytim…"
          className={cn(
            'mt-1 flex min-h-[72px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm',
            'ring-offset-background placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          )}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={submitting} onClick={() => void submitPartial()}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Tanlangan miqdorni qaytarish
        </Button>
        <Button type="button" variant="outline" disabled={submitting} onClick={() => void submitFull()}>
          Butun chek (qolgan hammasi)
        </Button>
      </div>
    </div>
  );
}
