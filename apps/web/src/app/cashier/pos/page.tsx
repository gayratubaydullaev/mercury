'use client';

import { PosWorkspace } from '@/components/pos/pos-workspace';

export default function CashierPosPage() {
  return (
    <PosWorkspace
      ordersBasePath="/cashier/orders"
      eyebrow="Kassa"
      title="POS — professional kassa"
      description="USB yoki kamera skaner. F2 kamera, F3 USB, F6 oxirgi tovar +1, F9 toʻlash. Faqat oʻz doʻkoningiz tovarlari."
      cashierOnly
    />
  );
}
