'use client';

import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/utils';

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Kutilmoqda',
  CONFIRMED: 'Tasdiqlangan',
  PROCESSING: 'Jarayonda',
  SHIPPED: 'Yuborilgan',
  DELIVERED: 'Yetkazilgan',
  CANCELLED: 'Bekor qilindi',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Kutilmoqda',
  PAID: "To'langan",
  FAILED: 'Muvaffaqiyatsiz',
  REFUNDED: 'Qaytarilgan',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CLICK: 'Click',
  PAYME: 'Payme',
  CASH: 'Naqd',
  CARD_ON_DELIVERY: 'Karta (yetkazishda)',
};

export function getOrderStatusLabel(status: string, deliveryType?: string): string {
  if (deliveryType === 'PICKUP') {
    if (status === 'SHIPPED') return 'Olib ketishga tayyor';
    if (status === 'DELIVERED') return 'Berildi (Olib ketildi)';
  }
  return ORDER_STATUS_LABELS[status] ?? status;
}

export type OrderDetailData = {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod?: string;
  paymentStatus?: string;
  deliveryType?: string;
  totalAmount: string;
  createdAt: string;
  updatedAt: string;
  notes?: string | null;
  /** Ombor chiqimi qayd etilgach (POS/checkout) — qaytaruv shu paytdan keyin */
  stockDeductedAt?: string | null;
  guestPhone?: string | null;
  guestEmail?: string | null;
  shippingAddress?: Record<string, unknown> | null;
  buyer?: { firstName?: string; lastName?: string; email?: string; phone?: string } | null;
  seller?: {
    firstName?: string;
    lastName?: string;
    shop?: { name?: string; slug?: string } | null;
  } | null;
  items?: Array<{
    id?: string;
    quantity: number;
    /** Qaytarilgan dona (sotuvchi qaytaruvi) */
    returnedQuantity?: number;
    price: string | number;
    product?: {
      id: string;
      title: string;
      sku?: string | null;
      stock?: number;
      unit?: string | null;
    };
    variant?: {
      sku?: string | null;
      stock?: number;
      options?: unknown;
      priceOverride?: string | null;
    } | null;
  }>;
};

function formatAddress(addr: Record<string, unknown> | null | undefined): string {
  if (!addr || typeof addr !== 'object') return '—';
  const parts = [addr.city, addr.district, addr.street, addr.house, addr.fullAddress].filter(
    (x) => x != null && String(x).trim() !== ''
  );
  return parts.length ? parts.map(String).join(', ') : '—';
}

function formatVariantOptions(opts: unknown): string {
  if (!opts || typeof opts !== 'object') return '';
  const entries = Object.entries(opts as Record<string, string>);
  return entries.length ? entries.map(([k, v]) => `${k}: ${v}`).join(', ') : '';
}

export function OrderDetailContent({ order }: { order: OrderDetailData }) {
  const isPickup = order.deliveryType === 'PICKUP';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{getOrderStatusLabel(order.status, order.deliveryType)}</Badge>
        <Badge variant="outline">{isPickup ? 'Olib ketish' : 'Yetkazib berish'}</Badge>
        {order.paymentStatus && (
          <Badge variant="outline">
            {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus} ·{' '}
            {PAYMENT_METHOD_LABELS[order.paymentMethod ?? ''] ?? order.paymentMethod ?? '—'}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mijoz</h3>
          {order.buyer ? (
            <ul className="space-y-1 text-sm">
              <li>
                <span className="text-muted-foreground">Ism: </span>
                {`${order.buyer.firstName ?? ''} ${order.buyer.lastName ?? ''}`.trim() || '—'}
              </li>
              <li>
                <span className="text-muted-foreground">Email: </span>
                {order.buyer.email ?? '—'}
              </li>
              <li>
                <span className="text-muted-foreground">Telefon: </span>
                {order.buyer.phone ?? order.guestPhone ?? '—'}
              </li>
            </ul>
          ) : (
            <ul className="space-y-1 text-sm">
              <li className="text-muted-foreground">Mehmon buyurtma</li>
              {order.guestPhone && (
                <li>
                  <span className="text-muted-foreground">Telefon: </span>
                  {order.guestPhone}
                </li>
              )}
              {order.guestEmail && (
                <li>
                  <span className="text-muted-foreground">Email: </span>
                  {order.guestEmail}
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sotuvchi</h3>
          <ul className="space-y-1 text-sm">
            <li>
              {order.seller
                ? `${order.seller.firstName ?? ''} ${order.seller.lastName ?? ''}`.trim() || '—'
                : '—'}
            </li>
            {order.seller?.shop?.name && (
              <li>
                <span className="text-muted-foreground">Doʻkon: </span>
                {order.seller.shop.name}
                {order.seller.shop.slug ? ` (${order.seller.shop.slug})` : ''}
              </li>
            )}
          </ul>
        </div>
      </div>

      {!isPickup && (
        <div className="rounded-lg border border-border/60 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Yetkazish manzili</h3>
          <p className="text-sm">
            {formatAddress(
              order.shippingAddress &&
                typeof order.shippingAddress === 'object' &&
                !Array.isArray(order.shippingAddress)
                ? (order.shippingAddress as Record<string, unknown>)
                : null
            )}
          </p>
        </div>
      )}

      {order.notes?.trim() ? (
        <div className="rounded-lg border border-border/60 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Izoh</h3>
          <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
        </div>
      ) : null}

      {Array.isArray(order.items) && order.items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Mahsulot</th>
                <th className="px-3 py-2">Variant</th>
                <th className="px-3 py-2">Birlik</th>
                <th className="px-3 py-2 text-right">Miqdor</th>
                <th className="px-3 py-2 text-right">Qaytarilgan</th>
                <th className="px-3 py-2 text-right">Ombor</th>
                <th className="px-3 py-2 text-right">Narx</th>
                <th className="px-3 py-2 text-right">Summa</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it, idx) => {
                const variantOpts = it.variant ? formatVariantOptions(it.variant.options) : '';
                const sku = it.variant?.sku ?? it.product?.sku ?? '—';
                const unit = it.product?.unit ?? 'dona';
                const stock = it.variant != null ? it.variant.stock : it.product?.stock;
                const ret = it.returnedQuantity ?? 0;
                const activeQty = Math.max(0, it.quantity - ret);
                const lineTotal = Number(it.price) * it.quantity;
                const activeLine = Number(it.price) * activeQty;
                return (
                  <tr key={it.id ?? idx} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{sku}</td>
                    <td className="px-3 py-2">{it.product?.title ?? '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{variantOpts || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{unit}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{it.quantity}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-800 dark:text-amber-200">
                      {ret > 0 ? ret : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{stock != null ? stock : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatPrice(Number(it.price))} soʻm</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {formatPrice(lineTotal)} soʻm
                      {ret > 0 ? (
                        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                          Qoldiq: {formatPrice(activeLine)} soʻm
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-4 border-t border-border/60 pt-4">
        <div className="text-xs text-muted-foreground">
          <p>Yaratilgan: {new Date(order.createdAt).toLocaleString('uz-UZ')}</p>
          <p>Yangilangan: {new Date(order.updatedAt).toLocaleString('uz-UZ')}</p>
          <p className="mt-1 font-mono text-[11px]">ID: {order.id}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums">Chek jami: {formatPrice(Number(order.totalAmount))} soʻm</p>
          {Array.isArray(order.items) && order.items.some((i) => (i.returnedQuantity ?? 0) > 0) ? (
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">
              Qaytaruvdan keyin (tahminiy):{' '}
              {formatPrice(
                order.items.reduce((s, i) => {
                  const q = Math.max(0, i.quantity - (i.returnedQuantity ?? 0));
                  return s + Number(i.price) * q;
                }, 0)
              )}{' '}
              soʻm
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
