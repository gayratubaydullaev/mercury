'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardPanel } from '@/components/dashboard/dashboard-panel';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';
import { ShoppingBag } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Kutilmoqda',
  CONFIRMED: 'Zakazingiz qabul qilindi',
  PROCESSING: 'Tayyorlanmoqda',
  SHIPPED: 'Yuborildi',
  DELIVERED: 'Yetkazildi',
  CANCELLED: 'Bekor qilindi',
};
function getOrderStatusLabel(status: string, deliveryType?: string): string {
  if (deliveryType === 'PICKUP') {
    if (status === 'SHIPPED') return 'Olib ketishga tayyor';
    if (status === 'DELIVERED') return 'Berildi (Olib ketildi)';
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

const PAGE_SIZE = 20;

export default function AdminOrdersPage() {
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [page, setPage] = useState(1);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    apiFetch(`${API_URL}/admin/orders?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ message: 'Xatolik yuz berdi' }));
  }, [token, page]);

  if (!token) return <DashboardAuthGate />;
  if (!data) return <Skeleton className="h-24 w-full" />;

  const orders = 'data' in data ? data.data : [];
  const total = 'total' in data ? data.total : 0;
  const totalPages = 'totalPages' in data ? data.totalPages : 1;
  const currentPage = 'page' in data ? data.page : 1;
  const errorMessage = 'message' in data ? data.message : null;

  return (
    <div className="min-w-0 max-w-full">
      <DashboardPageHeader
        eyebrow="Platforma"
        title="Barcha buyurtmalar"
        description={`Platformadagi barcha buyurtmalar. Jami: ${total}.`}
      />
      {errorMessage && orders.length === 0 && (
        <p className="mb-4 text-sm text-destructive">{errorMessage}</p>
      )}
      <DashboardPanel className="p-4 sm:p-5 md:p-6">
        {totalPages > 1 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="min-h-[40px] touch-manipulation" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Oldingi</Button>
            <span className="text-sm text-muted-foreground">Sahifa {currentPage} / {totalPages}</span>
            <Button variant="outline" size="sm" className="min-h-[40px] touch-manipulation" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Keyingi</Button>
          </div>
        )}
        {orders.length === 0 ? (
          <DashboardEmptyState
            icon={ShoppingBag}
            title="Buyurtmalar yoʻq"
            description="Hozircha roʻyxat boʻsh. Yangi buyurtmalar shu yerda paydo boʻladi."
          />
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <Card key={o.id} className="border-border/70 shadow-none">
                <CardContent className="p-4 sm:p-5">
                  <div className="mb-2 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                    <span className="font-mono text-sm font-medium">{o.orderNumber}</span>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{getOrderStatusLabel(o.status, o.deliveryType)}</Badge>
                      {o.paymentStatus && <Badge variant="outline">{o.paymentStatus}</Badge>}
                    </div>
                    <span className="text-base font-semibold sm:ml-auto">{formatPrice(Number(o.totalAmount))} soʻm</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {o.buyer && (
                      <span>Xaridor: {o.buyer.firstName} {o.buyer.lastName}</span>
                    )}
                    {o.seller && <span>Sotuvchi: {o.seller.firstName}</span>}
                    <span>{o.createdAt ? new Date(o.createdAt).toLocaleString('uz-UZ') : ''}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DashboardPanel>
    </div>
  );
}
