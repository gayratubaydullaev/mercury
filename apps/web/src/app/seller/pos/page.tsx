'use client';

import { PosWorkspace } from '@/components/pos/pos-workspace';

export default function SellerPosPage() {
  return (
    <PosWorkspace
      ordersBasePath="/seller/orders"
      eyebrow="Sotuvchi kabineti"
      title="POS — nuqta sotuvi"
      description="Doʻkonda jonli mijoz uchun tez buyurtma: savat toʻldiring, toʻlov turini tanlang va rasmiylashtiring. Kamera orqali SKU/shtrix-kod. Onlayn savatdan mustaqil."
    />
  );
}
