'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { Banknote, Truck } from 'lucide-react';

type Settings = {
  commissionRate: string;
  minPayoutAmount: string;
  paymentClickEnabled?: boolean;
  paymentPaymeEnabled?: boolean;
  paymentCashEnabled?: boolean;
  paymentCardOnDeliveryEnabled?: boolean;
  deliveryEnabled?: boolean;
  pickupEnabled?: boolean;
};

const defaultPaymentDelivery = {
  paymentClickEnabled: true,
  paymentPaymeEnabled: true,
  paymentCashEnabled: true,
  paymentCardOnDeliveryEnabled: true,
  deliveryEnabled: true,
  pickupEnabled: true,
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [commission, setCommission] = useState('');
  const [minPayout, setMinPayout] = useState('');
  const [paymentDelivery, setPaymentDelivery] = useState(defaultPaymentDelivery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  useEffect(() => {
    if (!token) return;
    setError('');
    apiFetch(`${API_URL}/admin/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((s: Settings) => {
        setSettings(s);
        setCommission(String(s.commissionRate ?? ''));
        setMinPayout(String(s.minPayoutAmount ?? ''));
        setPaymentDelivery({
          paymentClickEnabled: s.paymentClickEnabled ?? true,
          paymentPaymeEnabled: s.paymentPaymeEnabled ?? true,
          paymentCashEnabled: s.paymentCashEnabled ?? true,
          paymentCardOnDeliveryEnabled: s.paymentCardOnDeliveryEnabled ?? true,
          deliveryEnabled: s.deliveryEnabled ?? true,
          pickupEnabled: s.pickupEnabled ?? true,
        });
      })
      .catch(() => {
        setError('API ga ulanishda xatolik. Serverni ishga tushiring (pnpm run dev).');
        setSettings({ commissionRate: '5', minPayoutAmount: '100000' });
      });
  }, [token]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setError('');
    apiFetch(`${API_URL}/admin/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        commissionRate: Number(commission),
        minPayoutAmount: Number(minPayout),
        ...paymentDelivery,
      }),
    })
      .then((r) => r.json())
      .then((s: Settings) => {
        setSettings(s);
        setError('');
        setPaymentDelivery({
          paymentClickEnabled: s.paymentClickEnabled ?? true,
          paymentPaymeEnabled: s.paymentPaymeEnabled ?? true,
          paymentCashEnabled: s.paymentCashEnabled ?? true,
          paymentCardOnDeliveryEnabled: s.paymentCardOnDeliveryEnabled ?? true,
          deliveryEnabled: s.deliveryEnabled ?? true,
          pickupEnabled: s.pickupEnabled ?? true,
        });
        toast.success('Sozlamalar saqlandi');
      })
      .catch(() => {
        setError('Saqlashda xatolik. API ishlayotganini tekshiring.');
        toast.error('Sozlamalar saqlanmadi');
      })
      .finally(() => setLoading(false));
  };

  const toggle = (key: keyof typeof paymentDelivery) => {
    setPaymentDelivery((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!token) return <p>Kirish kerak</p>;
  if (!settings) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold mb-2">Platforma sozlamalari</h1>
        <p className="text-muted-foreground mb-6">Komissiya, toʻlov usullari va yetkazib berish</p>
        {error && <p className="text-destructive text-sm mb-4">{error}</p>}
      </div>

      <form onSubmit={save} className="space-y-6 max-w-lg">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Banknote className="h-5 w-5" /> Komissiya va minimal toʻlov</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input type="number" step="0.01" placeholder="Komissiya %" value={commission} onChange={(e) => setCommission(e.target.value)} />
            <Input type="number" placeholder="Min to'lov (soʻm)" value={minPayout} onChange={(e) => setMinPayout(e.target.value)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Toʻlov usullari</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">Qaysi toʻlov usullarini xaridorlar uchun koʻrsatish (yoqish/oʻchirish)</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={paymentDelivery.paymentClickEnabled} onChange={() => toggle('paymentClickEnabled')} />
              <span>Click</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={paymentDelivery.paymentPaymeEnabled} onChange={() => toggle('paymentPaymeEnabled')} />
              <span>Payme</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={paymentDelivery.paymentCashEnabled} onChange={() => toggle('paymentCashEnabled')} />
              <span>Naqd</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={paymentDelivery.paymentCardOnDeliveryEnabled} onChange={() => toggle('paymentCardOnDeliveryEnabled')} />
              <span>Karta (yetkazib berishda)</span>
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Yetkazib berish / samoviyoz</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">Qaysi usullarni xaridorlar uchun koʻrsatish</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={paymentDelivery.deliveryEnabled} onChange={() => toggle('deliveryEnabled')} />
              <span>Yetkazib berish</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={paymentDelivery.pickupEnabled} onChange={() => toggle('pickupEnabled')} />
              <span>Oʻzim olib ketaman (samoviyoz)</span>
            </label>
          </CardContent>
        </Card>

        <Button type="submit" disabled={loading}>Barcha sozlamalarni saqlash</Button>
      </form>
    </div>
  );
}
