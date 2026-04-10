'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/utils';
import { Printer, Share2, Copy } from 'lucide-react';
import { toast } from 'sonner';

export type PosReceiptOrder = {
  id: string;
  orderNumber: string;
  createdAt: string;
  totalAmount: string | number;
  paymentMethod: string;
  guestPhone?: string | null;
  items: Array<{
    quantity: number;
    price: string | number;
    product: { title: string };
    variant?: { options?: unknown } | null;
  }>;
  seller?: { shop?: { name?: string | null } | null } | null;
};

function variantLine(options: unknown): string {
  if (options && typeof options === 'object' && !Array.isArray(options)) {
    return Object.entries(options as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(', ');
  }
  return '';
}

function paymentLabel(m: string): string {
  if (m === 'CASH') return 'Naqd';
  if (m === 'CARD_ON_DELIVERY') return 'Karta';
  return m;
}

export function PosReceipt({ order }: { order: PosReceiptOrder }) {
  const printRef = useRef<HTMLDivElement>(null);
  const shopName = order.seller?.shop?.name?.trim() || 'Doʻkon';
  const lines = order.items.map((i) => {
    const v = i.variant ? variantLine(i.variant.options) : '';
    const unit = Number(i.price);
    return `${i.product.title}${v ? ` (${v})` : ''}\n  ${i.quantity} × ${formatPrice(unit)} = ${formatPrice(unit * i.quantity)}`;
  });
  const textBody = [
    shopName,
    `Chek: ${order.orderNumber}`,
    new Date(order.createdAt).toLocaleString('uz-UZ'),
    '—',
    ...lines,
    '—',
    `Jami: ${formatPrice(Number(order.totalAmount))}`,
    `Toʻlov: ${paymentLabel(order.paymentMethod)}`,
    order.guestPhone ? `Tel: ${order.guestPhone}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const print = () => {
    const w = window.open('', '_blank', 'width=400,height=600');
    if (!w) {
      toast.error('Chop etish oynasi bloklangan');
      return;
    }
    const node = printRef.current;
    w.document.write(`<!DOCTYPE html><html><head><title>Chek ${order.orderNumber}</title>
      <style>
        body{font-family:ui-monospace,monospace;font-size:12px;padding:16px;max-width:320px;margin:0 auto;}
        h1{font-size:14px;margin:0 0 8px;}
        pre{white-space:pre-wrap;margin:0;font:inherit;}
        @media print{@page{size:80mm auto;margin:4mm;}}
      </style></head><body>`);
    if (node) w.document.write(node.innerHTML);
    else w.document.write(`<pre>${textBody.replace(/</g, '&lt;')}</pre>`);
    w.document.write('</body></html>');
    w.document.close();
    w.focus();
    w.print();
    w.close();
  };

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Chek ${order.orderNumber}`, text: textBody });
        return;
      }
    } catch {
      /* fallback */
    }
    await navigator.clipboard.writeText(textBody);
    toast.success('Matn nusxalandi');
  };

  const copy = () => {
    void navigator.clipboard.writeText(textBody).then(() => toast.success('Chek matni nusxalandi'));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="default" size="sm" className="gap-1.5" onClick={print}>
          <Printer className="h-4 w-4" />
          Chop etish
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void share()}>
          <Share2 className="h-4 w-4" />
          Yuborish / nusxa
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={copy}>
          <Copy className="h-4 w-4" />
          Buferga
        </Button>
      </div>

      <div
        ref={printRef}
        className="rounded-md border border-dashed border-border/80 bg-muted/20 p-4 text-xs leading-relaxed print:border-0 print:bg-white"
      >
        <h1 className="text-center text-sm font-bold">{shopName}</h1>
        <p className="text-center text-muted-foreground">{order.orderNumber}</p>
        <p className="text-center text-muted-foreground">{new Date(order.createdAt).toLocaleString('uz-UZ')}</p>
        <hr className="my-3 border-border" />
        <ul className="space-y-2">
          {order.items.map((i, idx) => {
            const unit = Number(i.price);
            const v = i.variant ? variantLine(i.variant.options) : '';
            return (
              <li key={idx}>
                <div className="font-medium">{i.product.title}</div>
                {v ? <div className="text-muted-foreground">{v}</div> : null}
                <div>
                  {i.quantity} × {formatPrice(unit)} = {formatPrice(unit * i.quantity)}
                </div>
              </li>
            );
          })}
        </ul>
        <hr className="my-3 border-border" />
        <p className="flex justify-between font-semibold">
          <span>Jami</span>
          <span>{formatPrice(Number(order.totalAmount))}</span>
        </p>
        <p className="text-muted-foreground">Toʻlov: {paymentLabel(order.paymentMethod)}</p>
        {order.guestPhone ? <p className="text-muted-foreground">Tel: {order.guestPhone}</p> : null}
        <p className="mt-4 text-center text-[10px] text-muted-foreground">Rahmat!</p>
      </div>
    </div>
  );
}
