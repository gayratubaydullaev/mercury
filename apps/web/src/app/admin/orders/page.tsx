'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { downloadCsv } from '@/lib/export-csv';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardPanel } from '@/components/dashboard/dashboard-panel';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';
import { Download, ShoppingBag } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Kutilmoqda',
  CONFIRMED: 'Tasdiqlangan',
  PROCESSING: 'Jarayonda',
  SHIPPED: 'Yuborilgan',
  DELIVERED: 'Yetkazilgan',
  CANCELLED: 'Bekor',
};

const ORDER_STATUS_KEYS = Object.keys(STATUS_LABELS) as string[];

const SKIP_LABEL: Record<string, string> = {
  not_found: 'topilmadi',
  prepaid_unpaid: 'Click/Payme to‘lanmagan',
  unchanged: 'o‘zgarsiz',
  wrong_payment_method: 'faqat naqd/karta yetkazish',
  already_paid: 'allaqachon to‘langan',
};

function getOrderStatusLabel(status: string, deliveryType?: string): string {
  if (deliveryType === 'PICKUP') {
    if (status === 'SHIPPED') return 'Olib ketishga tayyor';
    if (status === 'DELIVERED') return 'Berildi';
  }
  return STATUS_LABELS[status] ?? status;
}

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  deliveryType?: string;
  paymentStatus?: string;
  totalAmount: string;
  createdAt: string;
  buyer?: { firstName?: string; lastName?: string };
  seller?: { firstName?: string };
};

type OrdersResponse =
  | { data: OrderRow[]; total: number; page: number; totalPages: number }
  | { message: string };

type BulkResult = { updated: number; skipped: { id: string; reason: string }[] };

const PAGE_SIZE = 20;
const CSV_EXPORT_MAX_ROWS = 5000;
const BULK_MAX = 100;

export default function AdminOrdersPage() {
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [exportingAll, setExportingAll] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkTargetStatus, setBulkTargetStatus] = useState<string>('CANCELLED');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, paymentFilter, debouncedSearch]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter, paymentFilter, debouncedSearch]);

  const load = useCallback(() => {
    if (!token) return;
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (paymentFilter !== 'all') params.set('paymentStatus', paymentFilter);
    if (debouncedSearch) params.set('search', debouncedSearch);
    apiFetch(`${API_URL}/admin/orders?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ message: 'Xatolik yuz berdi' }));
  }, [token, page, statusFilter, paymentFilter, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const exportCurrentPage = () => {
    if (!('data' in (data ?? {}))) return;
    const rows = (data as { data: OrderRow[] }).data;
    if (!rows.length) return;
    downloadCsv(
      `buyurtmalar-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Buyurtma raqami', 'Holat', 'Yetkazish', "To'lov", 'Summa (soʻm)', 'Xaridor', 'Sotuvchi', 'Vaqt'],
      rows.map((o) => [
        o.orderNumber,
        getOrderStatusLabel(o.status, o.deliveryType),
        o.deliveryType === 'PICKUP' ? 'Olib ketish' : 'Yetkazish',
        o.paymentStatus ?? '',
        formatPrice(Number(o.totalAmount)),
        o.buyer ? `${o.buyer.firstName ?? ''} ${o.buyer.lastName ?? ''}`.trim() : '—',
        o.seller?.firstName ?? '—',
        o.createdAt ? new Date(o.createdAt).toLocaleString('uz-UZ') : '',
      ])
    );
  };

  const exportAllFiltered = async () => {
    if (!token) return;
    setExportingAll(true);
    try {
      const all: OrderRow[] = [];
      let p = 1;
      let totalPages = 1;
      do {
        const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (paymentFilter !== 'all') params.set('paymentStatus', paymentFilter);
        if (debouncedSearch) params.set('search', debouncedSearch);
        const r = await apiFetch(`${API_URL}/admin/orders?${params}`, { headers: { Authorization: `Bearer ${token}` } });
        const json = (await r.json()) as OrdersResponse;
        if (!('data' in json) || !Array.isArray(json.data)) break;
        all.push(...json.data);
        totalPages = json.totalPages ?? 1;
        p += 1;
        if (all.length >= CSV_EXPORT_MAX_ROWS) {
          toast.message(`Eksport cheklovi: ${CSV_EXPORT_MAX_ROWS} qator`);
          break;
        }
      } while (p <= totalPages);
      if (!all.length) {
        toast.error('Eksport qilish uchun maʼlumot yoʻq');
        return;
      }
      downloadCsv(
        `buyurtmalar-hammasi-${new Date().toISOString().slice(0, 10)}.csv`,
        ['Buyurtma raqami', 'Holat', 'Yetkazish', "To'lov", 'Summa (soʻm)', 'Xaridor', 'Sotuvchi', 'Vaqt'],
        all.map((o) => [
          o.orderNumber,
          getOrderStatusLabel(o.status, o.deliveryType),
          o.deliveryType === 'PICKUP' ? 'Olib ketish' : 'Yetkazish',
          o.paymentStatus ?? '',
          formatPrice(Number(o.totalAmount)),
          o.buyer ? `${o.buyer.firstName ?? ''} ${o.buyer.lastName ?? ''}`.trim() : '—',
          o.seller?.firstName ?? '—',
          o.createdAt ? new Date(o.createdAt).toLocaleString('uz-UZ') : '',
        ])
      );
      toast.success(`${all.length} qator CSV yuklandi`);
    } catch {
      toast.error('Eksportda xatolik');
    } finally {
      setExportingAll(false);
    }
  };

  const formatBulkToast = (result: BulkResult) => {
    const parts = [`Yangilandi: ${result.updated}`];
    if (result.skipped.length) {
      const sample = result.skipped
        .slice(0, 5)
        .map((s) => `${s.id.slice(0, 8)}… (${SKIP_LABEL[s.reason] ?? s.reason})`)
        .join('; ');
      parts.push(`O‘tkazilgan: ${result.skipped.length}${sample ? ` — ${sample}` : ''}`);
    }
    toast.success(parts.join('. '));
  };

  const applyBulkStatus = async () => {
    if (!token || selectedIds.size === 0) return;
    if (selectedIds.size > BULK_MAX) {
      toast.error(`Bir vaqtning o‘zida maksimal ${BULK_MAX} ta buyurtma`);
      return;
    }
    setBulkLoading(true);
    try {
      const r = await apiFetch(`${API_URL}/admin/orders/bulk-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderIds: [...selectedIds], status: bulkTargetStatus }),
      });
      const j = (await r.json().catch(() => ({}))) as BulkResult & { message?: string | string[] };
      if (!r.ok) {
        const msg = Array.isArray(j.message) ? j.message.join(', ') : j.message;
        toast.error(msg ?? 'So‘rov bajarilmadi');
        return;
      }
      formatBulkToast({ updated: j.updated, skipped: j.skipped ?? [] });
      setSelectedIds(new Set());
      load();
    } catch {
      toast.error('Tarmoq xatosi');
    } finally {
      setBulkLoading(false);
    }
  };

  const applyBulkMarkPaid = async () => {
    if (!token || selectedIds.size === 0) return;
    if (selectedIds.size > BULK_MAX) {
      toast.error(`Bir vaqtning o‘zida maksimal ${BULK_MAX} ta buyurtma`);
      return;
    }
    setBulkLoading(true);
    try {
      const r = await apiFetch(`${API_URL}/admin/orders/bulk-mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderIds: [...selectedIds] }),
      });
      const j = (await r.json().catch(() => ({}))) as BulkResult & { message?: string | string[] };
      if (!r.ok) {
        const msg = Array.isArray(j.message) ? j.message.join(', ') : j.message;
        toast.error(msg ?? 'So‘rov bajarilmadi');
        return;
      }
      formatBulkToast({ updated: j.updated, skipped: j.skipped ?? [] });
      setSelectedIds(new Set());
      load();
    } catch {
      toast.error('Tarmoq xatosi');
    } finally {
      setBulkLoading(false);
    }
  };

  if (!token) return <DashboardAuthGate />;
  if (!data) return <Skeleton className="h-24 w-full" />;

  const orders = 'data' in data ? data.data : [];
  const total = 'total' in data ? data.total : 0;
  const totalPages = 'totalPages' in data ? data.totalPages : 1;
  const currentPage = 'page' in data ? data.page : 1;
  const errorMessage = 'message' in data ? data.message : null;

  const allPageSelected = orders.length > 0 && orders.every((o) => selectedIds.has(o.id));

  const toggleSelectAllPage = () => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (allPageSelected) {
        for (const o of orders) n.delete(o.id);
      } else {
        for (const o of orders) n.add(o.id);
      }
      return n;
    });
  };

  return (
    <div className="min-w-0 max-w-full">
      <DashboardPageHeader
        eyebrow="Platforma"
        title="Buyurtmalar"
        description={`Filtr, qidiruv, CSV, massa holat / to‘lov. Jami: ${total}. Tanlov: sahifalararo saqlanadi (maks. ${BULK_MAX} ta bir so‘rovda).`}
      />

      {errorMessage && orders.length === 0 && <p className="mb-4 text-sm text-destructive">{errorMessage}</p>}

      <DashboardPanel className="p-0">
        <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/25 p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[160px] flex-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Qidiruv</label>
            <Input
              placeholder="Raqam, telefon, ism..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="w-full min-w-[140px] space-y-1.5 sm:w-40">
            <label className="text-xs font-medium text-muted-foreground">Holat</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Hammasi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Hammasi</SelectItem>
                {ORDER_STATUS_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {STATUS_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full min-w-[140px] space-y-1.5 sm:w-40">
            <label className="text-xs font-medium text-muted-foreground">To‘lov</label>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Hammasi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Hammasi</SelectItem>
                <SelectItem value="PENDING">Kutilmoqda</SelectItem>
                <SelectItem value="PAID">To‘langan</SelectItem>
                <SelectItem value="FAILED">Muvaffaqiyatsiz</SelectItem>
                <SelectItem value="REFUNDED">Qaytarilgan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button type="button" variant="outline" size="sm" className="h-9 gap-2" onClick={exportCurrentPage} disabled={!orders.length}>
              <Download className="h-4 w-4" />
              CSV (sahifa)
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9 gap-2"
              onClick={() => void exportAllFiltered()}
              disabled={exportingAll || total === 0}
            >
              <Download className="h-4 w-4" />
              {exportingAll ? 'Yuklanmoqda…' : 'CSV (filtr bo‘yicha hammasi)'}
            </Button>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex flex-col gap-3 border-b border-border/60 bg-primary/[0.06] px-4 py-3 dark:bg-primary/10 sm:flex-row sm:flex-wrap sm:items-end">
            <p className="text-sm font-medium">
              Tanlangan: <span className="tabular-nums">{selectedIds.size}</span> / {BULK_MAX}
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Yangi holat</span>
                <Select value={bulkTargetStatus} onValueChange={setBulkTargetStatus}>
                  <SelectTrigger className="h-9 w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUS_KEYS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {STATUS_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" size="sm" className="h-9" disabled={bulkLoading} onClick={() => void applyBulkStatus()}>
                Holatni qo‘llash
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-9"
                disabled={bulkLoading}
                onClick={() => void applyBulkMarkPaid()}
              >
                To‘lov: PAID (naqd/karta)
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-9" onClick={() => setSelectedIds(new Set())}>
                Tanlovni tozalash
              </Button>
            </div>
          </div>
        )}

        <div className="p-4 sm:p-5">
          {totalPages > 1 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-9"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Oldingi
              </Button>
              <span className="text-sm text-muted-foreground">
                Sahifa {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="min-h-9"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Keyingi
              </Button>
            </div>
          )}

          {orders.length === 0 ? (
            <DashboardEmptyState
              icon={ShoppingBag}
              title="Buyurtmalar topilmadi"
              description="Filtr yoki qidiruvni o‘zgartiring — yoki hozircha ro‘yxat bo‘sh."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/50 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="w-10 px-2 py-2.5">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleSelectAllPage}
                        className="h-4 w-4 rounded border-input"
                        aria-label="Joriy sahifani tanlash"
                      />
                    </th>
                    <th className="px-3 py-2.5">Buyurtma</th>
                    <th className="px-3 py-2.5">Holat</th>
                    <th className="px-3 py-2.5">To‘lov</th>
                    <th className="px-3 py-2.5 text-right">Summa</th>
                    <th className="px-3 py-2.5">Xaridor</th>
                    <th className="px-3 py-2.5">Sotuvchi</th>
                    <th className="px-3 py-2.5">Vaqt</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-border/40 transition-colors hover:bg-muted/20">
                      <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(o.id)}
                          onChange={() => toggleSelected(o.id)}
                          className="h-4 w-4 rounded border-input"
                          aria-label={`Tanlash ${o.orderNumber}`}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="font-mono text-xs font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                        >
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="secondary" className="font-normal">
                          {getOrderStatusLabel(o.status, o.deliveryType)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        {o.paymentStatus && (
                          <Badge variant="outline" className="font-normal">
                            {o.paymentStatus}
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{formatPrice(Number(o.totalAmount))} soʻm</td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {o.buyer ? `${o.buyer.firstName ?? ''} ${o.buyer.lastName ?? ''}`.trim() || '—' : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{o.seller?.firstName ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {o.createdAt ? new Date(o.createdAt).toLocaleString('uz-UZ') : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DashboardPanel>
    </div>
  );
}
