'use client';

import { PosWorkspace } from '@/components/pos/pos-workspace';

export default function CashierPosPage() {
  return (
    <PosWorkspace
      ordersBasePath="/cashier/orders"
      eyebrow="Kassa"
      title="POS — professional kassa"
      description="USB yoki kamera skaner, tezkor tugmalar (F2 kamera, F3 kod maydoni, F9 toʻlash). Faqat oʻz doʻkoningiz tovarlari."
      cashierOnly
    />
  );
}
