'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { Banknote, Truck, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

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
            <div className="space-y-2">
              <Label htmlFor="commission">Komissiya (%)</Label>
              <Input id="commission" type="number" step="0.01" min="0" max="100" placeholder="5" value={commission} onChange={(e) => setCommission(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minPayout">Minimal toʻlov (soʻm)</Label>
              <Input id="minPayout" type="number" min="0" placeholder="100000" value={minPayout} onChange={(e) => setMinPayout(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Toʻlov usullari</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Qaysi toʻlov usullarini xaridorlar uchun koʻrsatish</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={cn('flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50', paymentDelivery.paymentClickEnabled && 'border-primary bg-primary/5')}>
                <input type="checkbox" className="h-4 w-4 rounded border-input" checked={paymentDelivery.paymentClickEnabled} onChange={() => toggle('paymentClickEnabled')} />
                <span className="font-medium">Click</span>
              </label>
              <label className={cn('flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50', paymentDelivery.paymentPaymeEnabled && 'border-primary bg-primary/5')}>
                <input type="checkbox" className="h-4 w-4 rounded border-input" checked={paymentDelivery.paymentPaymeEnabled} onChange={() => toggle('paymentPaymeEnabled')} />
                <span className="font-medium">Payme</span>
              </label>
              <label className={cn('flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50', paymentDelivery.paymentCashEnabled && 'border-primary bg-primary/5')}>
                <input type="checkbox" className="h-4 w-4 rounded border-input" checked={paymentDelivery.paymentCashEnabled} onChange={() => toggle('paymentCashEnabled')} />
                <span className="font-medium">Naqd</span>
              </label>
              <label className={cn('flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50', paymentDelivery.paymentCardOnDeliveryEnabled && 'border-primary bg-primary/5')}>
                <input type="checkbox" className="h-4 w-4 rounded border-input" checked={paymentDelivery.paymentCardOnDeliveryEnabled} onChange={() => toggle('paymentCardOnDeliveryEnabled')} />
                <span className="font-medium">Karta (yetkazib berishda)</span>
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Yetkazib berish</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Qaysi usullarni xaridorlar uchun koʻrsatish</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={cn('flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50', paymentDelivery.deliveryEnabled && 'border-primary bg-primary/5')}>
                <input type="checkbox" className="h-4 w-4 rounded border-input" checked={paymentDelivery.deliveryEnabled} onChange={() => toggle('deliveryEnabled')} />
                <span className="font-medium">Yetkazib berish</span>
              </label>
              <label className={cn('flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50', paymentDelivery.pickupEnabled && 'border-primary bg-primary/5')}>
                <input type="checkbox" className="h-4 w-4 rounded border-input" checked={paymentDelivery.pickupEnabled} onChange={() => toggle('pickupEnabled')} />
                <span className="font-medium">Oʻzim olib ketaman</span>
              </label>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={loading}>Barcha sozlamalarni saqlash</Button>
      </form>
    </div>
  );
}
