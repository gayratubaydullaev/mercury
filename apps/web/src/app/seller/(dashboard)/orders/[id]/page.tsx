'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardPanel } from '@/components/dashboard/dashboard-panel';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';
import {
  OrderDetailContent,
  getOrderStatusLabel,
  type OrderDetailData,
} from '@/components/dashboard/order-detail-content';
import { OrderAuditPanel } from '@/components/dashboard/order-audit-panel';
import { SellerOrderReturnPanel } from '@/components/dashboard/seller-order-return-panel';
import { PosReceipt, type PosReceiptOrder } from '@/components/pos/pos-receipt';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, Receipt } from 'lucide-react';

function orderDetailToPosReceipt(o: OrderDetailData): PosReceiptOrder {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    createdAt: o.createdAt,
    totalAmount: o.totalAmount,
    paymentMethod: o.paymentMethod ?? 'CASH',
    guestPhone: o.guestPhone,
    items: (o.items ?? []).map((it) => ({
      quantity: it.quantity,
      price: it.price,
      product: { title: it.product?.title ?? '—' },
      variant: it.variant ? { options: it.variant.options } : null,
    })),
    seller: o.seller,
  };
}

export default function SellerOrderDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const [order, setOrder] = useState<OrderDetailData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const load = useCallback(() => {
    if (!token || !id) return;
    apiFetch(`${API_URL}/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.status === 404 || !r.ok) {
          setNotFound(true);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setNotFound(false);
          setOrder(data as OrderDetailData);
        }
      })
      .catch(() => setNotFound(true));
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = (status: string) => {
    if (!token || !order) return;
    apiFetch(`${API_URL}/orders/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    })
      .then(() => {
        toast.success(`Holat: ${getOrderStatusLabel(status, order.deliveryType)}`);
        setOrder((o) => (o ? { ...o, status } : null));
        setAuditRefreshKey((k) => k + 1);
      })
      .catch(() => toast.error('Holat oʻzgartirilmadi'));
  };

  const markAsPaid = () => {
    if (!token) return;
    apiFetch(`${API_URL}/orders/${id}/mark-paid`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        toast.success("To'lov belgilandi");
        setOrder((o) => (o ? { ...o, paymentStatus: 'PAID' } : null));
        setAuditRefreshKey((k) => k + 1);
      })
      .catch((e) => toast.error(e?.message ?? "To'lov belgilanmadi"));
  };

  if (!token) return <DashboardAuthGate />;

  if (!id) {
    return (
      <div>
        <DashboardPageHeader eyebrow="Sotuvchi" title="Buyurtma" description="Noto‘g‘ri havola." />
        <Button variant="outline" asChild>
          <Link href="/seller/orders">Roʻyxatga qaytish</Link>
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
        <DashboardPageHeader eyebrow="Sotuvchi" title="Buyurtma topilmadi" />
        <Button variant="outline" asChild>
          <Link href="/seller/orders">Buyurtmalar</Link>
        </Button>
      </div>
    );
  }

  const isPickup = order.deliveryType === 'PICKUP';
  const isPrepaid = order.paymentMethod === 'CLICK' || order.paymentMethod === 'PAYME';
  const canShipOrDeliver = !isPrepaid || order.paymentStatus === 'PAID';

  return (
    <div className="min-w-0 max-w-full">
      <DashboardPageHeader
        eyebrow="Sotuvchi kabineti"
        title={order.orderNumber}
        description="Buyurtmani boshqarish va holatni yangilash."
      >
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={() => setReceiptOpen(true)}>
            <Receipt className="h-4 w-4" aria-hidden />
            Chek koʻrish
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/seller/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Roʻyxat
            </Link>
          </Button>
        </div>
      </DashboardPageHeader>

      <DashboardPanel className="space-y-6 p-4 sm:p-6">
        <OrderDetailContent order={order} />

        <div className="border-t border-border/60 pt-6">
          <h3 className="mb-3 text-sm font-semibold">Harakatlar</h3>
          <div className="flex flex-wrap gap-2">
            {(order.paymentMethod === 'CASH' || order.paymentMethod === 'CARD_ON_DELIVERY') && order.paymentStatus === 'PENDING' && (
              <Button size="sm" variant="secondary" onClick={markAsPaid}>
                To‘lov qabul qilindi
              </Button>
            )}
            {order.status === 'PENDING' && (
              <>
                <Button size="sm" onClick={() => updateStatus('CONFIRMED')}>
                  Tasdiqlash
                </Button>
                <Button size="sm" variant="destructive" onClick={() => updateStatus('CANCELLED')}>
                  Bekor qilish
                </Button>
              </>
            )}
            {order.status === 'CONFIRMED' && (
              <>
                <Button size="sm" onClick={() => updateStatus('PROCESSING')}>
                  Qayta ishlash
                </Button>
                {canShipOrDeliver ? (
                  <Button size="sm" onClick={() => updateStatus('SHIPPED')}>
                    {isPickup ? 'Tayyor (olib ketish)' : 'Yuborildi'}
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" disabled title={"Click/Payme to'lovi qilinmaguncha"}>
                    {isPickup ? 'Tayyor' : 'Yuborildi'} — to‘lov kutilmoqda
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={() => updateStatus('CANCELLED')}>
                  Bekor qilish
                </Button>
              </>
            )}
            {order.status === 'PROCESSING' && (
              <>
                {canShipOrDeliver ? (
                  <Button size="sm" onClick={() => updateStatus('SHIPPED')}>
                    {isPickup ? 'Tayyor (olib ketish)' : 'Yuborildi'}
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" disabled>
                    {isPickup ? 'Tayyor' : 'Yuborildi'} — to‘lov kutilmoqda
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={() => updateStatus('CANCELLED')}>
                  Bekor qilish
                </Button>
              </>
            )}
            {order.status === 'SHIPPED' &&
              (canShipOrDeliver ? (
                <Button size="sm" onClick={() => updateStatus('DELIVERED')}>
                  {isPickup ? 'Olib ketildi' : 'Yetkazildi'}
                </Button>
              ) : (
                <Button size="sm" variant="secondary" disabled>
                  Yakunlash — to‘lov kutilmoqda
                </Button>
              ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Yakunlagach{' '}
            <Link href="/seller/orders" className="text-primary underline">
              roʻyxatga qaytishingiz
            </Link>{' '}
            mumkin.
          </p>
        </div>

        <div className="border-t border-border/60 pt-6">
          <SellerOrderReturnPanel
            orderId={id}
            token={token}
            order={order}
            onSuccess={(next) => {
              setOrder(next);
              setAuditRefreshKey((k) => k + 1);
            }}
          />
        </div>
      </DashboardPanel>

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chek</DialogTitle>
            <DialogDescription>
              {order.orderNumber} — chop etish yoki matnni nusxalash (sotuvchi kabineti).
            </DialogDescription>
          </DialogHeader>
          <PosReceipt order={orderDetailToPosReceipt(order)} />
        </DialogContent>
      </Dialog>

      <OrderAuditPanel token={token} orderId={id} refreshKey={auditRefreshKey} />
    </div>
  );
}
