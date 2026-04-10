'use client';

import { PosWorkspace } from '@/components/pos/pos-workspace';

export default function SellerPosPage() {
  return (
    <PosWorkspace
      ordersBasePath="/seller/orders"
      eyebrow="Sotuvchi kabineti"
      title="POS — nuqta sotuvi"
      description="Jonli mijoz: savat, toʻlov, chek. F2 kamera, F3 USB, F6 oxirgi tovar +1, F9 toʻlash. SKU/shtrix-kod skaneri."
    />
  );
}
