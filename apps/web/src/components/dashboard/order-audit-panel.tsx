'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { DashboardPanel } from '@/components/dashboard/dashboard-panel';

export type OrderAuditRow = {
  id: string;
  action: string;
  actorUserId: string | null;
  meta: unknown;
  createdAt: string;
};

const AUDIT_ACTION_LABEL: Record<string, string> = {
  ORDER_CREATED: 'Buyurtma yaratildi',
  ADMIN_BULK_STATUS: 'Ommaviy holat',
  ADMIN_BULK_MARK_PAID: 'Ommaviy to‘lov (PAID)',
  SELLER_STATUS: 'Sotuvchi: holat',
  SELLER_MARK_PAID: 'Sotuvchi: to‘lov qabul',
  GATEWAY_MARK_PAID: 'Click / Payme: to‘langan',
};

type OrderAuditPanelProps = {
  token: string | null;
  orderId: string;
  /** Increment after mutations to refetch the log. */
  refreshKey?: number;
};

export function OrderAuditPanel({ token, orderId, refreshKey = 0 }: OrderAuditPanelProps) {
  const [audit, setAudit] = useState<OrderAuditRow[] | null>(null);

  useEffect(() => {
    if (!token || !orderId) return;
    setAudit(null);
    apiFetch(`${API_URL}/orders/${orderId}/audit`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: unknown) => setAudit(Array.isArray(rows) ? (rows as OrderAuditRow[]) : []))
      .catch(() => setAudit([]));
  }, [token, orderId, refreshKey]);

  return (
    <DashboardPanel className="mt-6 p-4 sm:p-6">
      <h2 className="mb-4 text-sm font-semibold">Auditoriya jurnali</h2>
      {audit === null ? (
        <Skeleton className="h-24 w-full rounded-lg" />
      ) : audit.length === 0 ? (
        <p className="text-sm text-muted-foreground">Hozircha yozuvlar yoʻq.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Vaqt</th>
                <th className="px-3 py-2">Harakat</th>
                <th className="px-3 py-2">Ijrochi</th>
                <th className="px-3 py-2">Tafsilot</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((row) => (
                <tr key={row.id} className="border-b border-border/40 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString('uz-UZ')}
                  </td>
                  <td className="px-3 py-2">{AUDIT_ACTION_LABEL[row.action] ?? row.action}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {row.actorUserId ? `${row.actorUserId.slice(0, 8)}…` : '—'}
                  </td>
                  <td className="max-w-[280px] truncate px-3 py-2 font-mono text-xs text-muted-foreground" title={JSON.stringify(row.meta)}>
                    {row.meta != null ? JSON.stringify(row.meta) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardPanel>
  );
}
