'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { MessageCircle, Send, Unplug } from 'lucide-react';

type PickupAddress = { city?: string; district?: string; street?: string; house?: string; phone?: string } | null;

export default function SellerSettingsPage() {
  const [shop, setShop] = useState<{
    name: string;
    slug: string;
    description: string | null;
    pickupAddress: PickupAddress;
    chatEnabled?: boolean;
  } | null>(null);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [chatSaving, setChatSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pickup, setPickup] = useState<PickupAddress>({ city: '', district: '', street: '', house: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<{ connected: boolean; telegramType?: string } | null>(null);
  const [telegramCode, setTelegramCode] = useState('');
  const [telegramLinking, setTelegramLinking] = useState(false);
  const [telegramDisconnecting, setTelegramDisconnecting] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const loadTelegramStatus = () => {
    if (!token) return;
    apiFetch(`${API_URL}/seller/telegram`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setTelegramStatus)
      .catch(() => setTelegramStatus({ connected: false }));
  };

  useEffect(() => {
    if (!token) return;
    apiFetch(`${API_URL}/seller/shop`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((s) => {
        setShop(s);
        if (s) {
          setName(s.name ?? '');
          setDescription(s.description ?? '');
          setChatEnabled(s.chatEnabled !== false);
          const pa = s.pickupAddress && typeof s.pickupAddress === 'object' ? s.pickupAddress : {};
          setPickup({
            city: pa.city ?? '',
            district: pa.district ?? '',
            street: pa.street ?? '',
            house: pa.house ?? '',
            phone: pa.phone ?? '',
          });
        }
      })
      .catch(() => setShop(null));
    loadTelegramStatus();
  }, [token]);

  const linkTelegram = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !telegramCode.trim()) return;
    setTelegramLinking(true);
    apiFetch(`${API_URL}/seller/telegram/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: telegramCode.trim().toUpperCase() }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          toast.success('Telegram ulandi');
          setTelegramCode('');
          loadTelegramStatus();
        } else throw new Error(data.message);
      })
      .catch((err) => toast.error(err?.message ?? 'Kod notoʻgʻri yoki muddati tugagan'))
      .finally(() => setTelegramLinking(false));
  };

  const disconnectTelegram = () => {
    if (!token) return;
    setTelegramDisconnecting(true);
    apiFetch(`${API_URL}/seller/telegram/disconnect`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          toast.success('Telegram uzildi');
          loadTelegramStatus();
        }
      })
      .catch(() => toast.error('Uzishda xatolik'))
      .finally(() => setTelegramDisconnecting(false));
  };

  const toggleChat = (enabled: boolean) => {
    if (!token) return;
    setChatSaving(true);
    apiFetch(`${API_URL}/seller/shop/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ chatEnabled: enabled }),
    })
      .then((r) => r.json())
      .then((s) => {
        setChatEnabled(s?.chatEnabled !== false);
        setShop((prev) => (prev ? { ...prev, chatEnabled: s?.chatEnabled } : prev));
        toast.success(enabled ? 'Chat yoqildi' : 'Chat o‘chirildi');
      })
      .catch(() => toast.error('O‘zgartirishda xatolik'))
      .finally(() => setChatSaving(false));
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    const pickupAddress =
      pickup?.city || pickup?.street || pickup?.house || pickup?.phone
        ? {
            city: pickup.city?.trim() || undefined,
            district: pickup.district?.trim() || undefined,
            street: pickup.street?.trim() || undefined,
            house: pickup.house?.trim() || undefined,
            phone: pickup.phone?.trim() || undefined,
          }
        : null;
    apiFetch(`${API_URL}/seller/shop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, description, pickupAddress }),
    })
      .then((r) => r.json())
      .then((s) => {
        setShop(s);
        toast.success('Doʻkon sozlamalari saqlandi');
      })
      .catch(() => toast.error('Saqlashda xatolik'))
      .finally(() => setLoading(false));
  };

  if (!token) return <p>Kirish kerak</p>;
  if (shop === undefined) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Doʻkon sozlamalari</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Nomi, tavsif va oʻzim olib ketish manzili</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Maʼlumot</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <Input placeholder="Doʻkon nomi" value={name} onChange={(e) => setName(e.target.value)} required />
            <textarea placeholder="Tavsif" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]" />
            <Button type="submit" disabled={loading}>{loading ? 'Saqlanmoqda...' : 'Saqlash'}</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Telegram bildirishnomalar
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Botni shaxsiy chat, guruh yoki kanalingizga qoʻshing — yangi buyurtmalar va holat oʻzgarishlari haqida xabar olasiz. Bot orqali buyurtma holatini boshqarishingiz mumkin.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {telegramStatus?.connected ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-green-600">Telegram ulangan</span>
              {telegramStatus.telegramType && (
                <span className="text-xs text-muted-foreground">({telegramStatus.telegramType})</span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[40px] touch-manipulation"
                disabled={telegramDisconnecting}
                onClick={disconnectTelegram}
              >
                <Unplug className="h-4 w-4 mr-1" />
                Uzish
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                1) Telegramda MyShopUZ sotuvchi botini qidiring va <b>/start</b> yoki <b>/link</b> yuboring.<br />
                2) Bot sizga 6 ta belgili kod beradi. Uni quyida kiriting.
              </p>
              <form onSubmit={linkTelegram} className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[140px]">
                  <Label htmlFor="telegram-code" className="text-sm">Kod</Label>
                  <Input
                    id="telegram-code"
                    placeholder="AB12CD"
                    value={telegramCode}
                    onChange={(e) => setTelegramCode(e.target.value.toUpperCase().slice(0, 6))}
                    className="mt-1 font-mono min-h-[40px]"
                    maxLength={6}
                  />
                </div>
                <Button type="submit" disabled={telegramLinking || !telegramCode.trim()} className="min-h-[40px] touch-manipulation">
                  {telegramLinking ? 'Ulanmoqda...' : 'Ulash'}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Xaridorlar bilan chat
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Chat yoqilganda xaridorlar sizga mahsulot haqida yozishi mumkin. O‘chirsangiz, yangi xabarlar qabul qilinmaydi (oldingi suhbatlar ko‘rinadi).
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="chat-toggle"
              checked={chatEnabled}
              onChange={(e) => toggleChat(e.target.checked)}
              disabled={chatSaving || shop === null}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <Label htmlFor="chat-toggle" className="cursor-pointer text-sm font-medium">
              Chatni qabul qilish — xaridorlar sizga yozishi mumkin
            </Label>
          </div>
          {chatSaving && <p className="text-xs text-muted-foreground mt-2">Saqlanmoqda...</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Oʻzim olib ketish manzili (самовывоз)</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Xaridorlar buyurtmani qayerdan olib ketishini koʻrsating</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Shahar</label>
                <Input placeholder="Shahar" value={pickup?.city ?? ''} onChange={(e) => setPickup((p) => ({ ...p, city: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Tuman</label>
                <Input placeholder="Tuman" value={pickup?.district ?? ''} onChange={(e) => setPickup((p) => ({ ...p, district: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Koʻcha</label>
                <Input placeholder="Koʻcha" value={pickup?.street ?? ''} onChange={(e) => setPickup((p) => ({ ...p, street: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Uy</label>
                <Input placeholder="Uy raqami" value={pickup?.house ?? ''} onChange={(e) => setPickup((p) => ({ ...p, house: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Aloqa telefoni</label>
              <Input placeholder="+998..." value={pickup?.phone ?? ''} onChange={(e) => setPickup((p) => ({ ...p, phone: e.target.value }))} className="mt-1" />
            </div>
            <Button type="submit" disabled={loading}>{loading ? 'Saqlanmoqda...' : 'Manzilni saqlash'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
