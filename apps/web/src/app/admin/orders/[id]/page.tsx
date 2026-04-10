'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardPanel } from '@/components/dashboard/dashboard-panel';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';
import { OrderDetailContent, type OrderDetailData } from '@/components/dashboard/order-detail-content';
import { OrderAuditPanel } from '@/components/dashboard/order-audit-panel';
import { ArrowLeft } from 'lucide-react';

export default function AdminOrderDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const [order, setOrder] = useState<OrderDetailData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  useEffect(() => {
    if (!token || !id) return;
    apiFetch(`${API_URL}/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!r.ok) {
          setNotFound(true);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data) setOrder(data as OrderDetailData);
      })
      .catch(() => setNotFound(true));
  }, [token, id]);

  if (!token) return <DashboardAuthGate />;

  if (!id) {
    return (
      <div>
        <DashboardPageHeader eyebrow="Platforma" title="Buyurtma" description="Noto‘g‘ri havola." />
        <Button variant="outline" asChild>
          <Link href="/admin/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Roʻyxatga qaytish
          </Link>
        </Button>
      </div>
    );
  }

  if (order === null && !notFound) {
    return (
      <div>
        <Skeleton className="mb-6 h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div>
        <DashboardPageHeader eyebrow="Platforma" title="Buyurtma topilmadi" description="Bunday buyurtma yoʻq yoki kirish huquqi yoʻq." />
        <Button variant="outline" asChild>
          <Link href="/admin/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Barcha buyurtmalar
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full">
      <DashboardPageHeader
        eyebrow="Platforma"
        title={order.orderNumber}
        description="Koʻrish va harakatlar jurnali (sotuvchi, ommaviy admin va boshqa yozuvlar)."
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Roʻyxat
          </Link>
        </Button>
      </DashboardPageHeader>

      <DashboardPanel className="p-4 sm:p-6">
        <OrderDetailContent order={order} />
      </DashboardPanel>

      <OrderAuditPanel token={token} orderId={id} />
    </div>
  );
}
