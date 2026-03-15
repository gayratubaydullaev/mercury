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
import { MessageCircle, Send, Unplug, FileText, X } from 'lucide-react';

type PickupAddress = { city?: string; district?: string; street?: string; house?: string; phone?: string } | null;

export default function SellerSettingsPage() {
  const [shop, setShop] = useState<{
    name: string;
    slug: string;
    description: string | null;
    pickupAddress: PickupAddress;
    chatEnabled?: boolean;
    chatWithSellerEnabled?: boolean;
    legalType?: string | null;
    legalName?: string | null;
    ogrn?: string | null;
    inn?: string | null;
    documentUrls?: string[] | null;
    pendingUpdate?: {
      requestedName: string;
      requestedSlug: string;
      requestedDescription: string | null;
      requestedLegalType?: string | null;
      requestedLegalName?: string | null;
      requestedOgrn?: string | null;
      requestedInn?: string | null;
      requestedDocumentUrls?: string[] | null;
      createdAt: string;
    } | null;
  } | null>(null);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [chatSaving, setChatSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pickup, setPickup] = useState<PickupAddress>({ city: '', district: '', street: '', house: '', phone: '' });
  const [legalType, setLegalType] = useState('');
  const [legalName, setLegalName] = useState('');
  const [ogrn, setOgrn] = useState('');
  const [inn, setInn] = useState('');
  const [documentUrls, setDocumentUrls] = useState<string[]>([]);
  const [docUploading, setDocUploading] = useState(false);
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
          setLegalType(s.pendingUpdate?.requestedLegalType ?? s.legalType ?? '');
          setLegalName(s.pendingUpdate?.requestedLegalName ?? s.legalName ?? '');
          setOgrn(s.pendingUpdate?.requestedOgrn ?? s.ogrn ?? '');
          setInn(s.pendingUpdate?.requestedInn ?? s.inn ?? '');
          setDocumentUrls(Array.isArray(s.pendingUpdate?.requestedDocumentUrls) ? s.pendingUpdate.requestedDocumentUrls : Array.isArray(s.documentUrls) ? s.documentUrls : []);
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

  const uploadDocuments = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !token) return;
    e.target.value = '';
    setDocUploading(true);
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    let added = 0;
    for (const file of Array.from(files).slice(0, 10)) {
      const form = new FormData();
      form.append('file', file);
      try {
        const r = await fetch(`${API_URL}/upload/image`, { method: 'POST', headers, body: form, credentials: 'include' });
        const data = await r.json();
        if (data?.url) {
          setDocumentUrls((prev) => [...prev, data.url]);
          added++;
        }
      } catch {
        // skip
      }
    }
    if (added > 0) toast.success(`${added} ta hujjat yuklandi`);
    setDocUploading(false);
  };

  const removeDocument = (index: number) => {
    setDocumentUrls((prev) => prev.filter((_, i) => i !== index));
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
      body: JSON.stringify({
        name,
        description,
        pickupAddress,
        legalType: legalType.trim() || null,
        legalName: legalName.trim() || null,
        ogrn: ogrn.trim() || null,
        inn: inn.trim() || null,
        documentUrls: documentUrls.length ? documentUrls : null,
      }),
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
        <CardHeader>
          <CardTitle>Maʼlumot</CardTitle>
          <p className="text-sm text-muted-foreground font-normal mt-1">
            Nomi, slug va tavsif o‘zgarishlari admin tasdiqidan keyin qo‘llanadi. Manzil va chat sozlamalari darhol yangilanadi.
          </p>
          {shop?.pendingUpdate && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
              O‘zgarishlar (nomi, tavsif, yuridik maʼlumotlar) admin tasdiqini kutyapti: «{shop.pendingUpdate.requestedName}» (slug: {shop.pendingUpdate.requestedSlug})
            </p>
          )}
        </CardHeader>
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
            <FileText className="h-5 w-5" />
            Yuridik maʼlumotlar (ИП / ООО)
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Toʻliq nomi, OGRN, INN va hujjatlar fotosuratlari (masalan, roʻyxatdan oʻtish guvohnomasi)
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Shakl</Label>
              <select
                value={legalType}
                onChange={(e) => setLegalType(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background h-10 px-3 text-sm"
              >
                <option value="">Tanlang</option>
                <option value="IP">ИП (Yakka tadbirkor)</option>
                <option value="OOO">ООО (MChJ)</option>
              </select>
            </div>
            <div>
              <Label className="text-sm font-medium">Toʻliq nomi (ИП yoki OOO)</Label>
              <Input
                placeholder="Masalan: IP Ivanov Ivan Ivanovich"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">OGRN</Label>
                <Input placeholder="OGRN raqami" value={ogrn} onChange={(e) => setOgrn(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm font-medium">INN (ИНН)</Label>
                <Input placeholder="INN raqami" value={inn} onChange={(e) => setInn(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Hujjatlar (fotosuratlar)</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">Roʻyxatdan oʻtish, litsenziya va boshqa hujjatlar</p>
              <input
                type="file"
                accept="image/*"
                multiple
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:text-sm"
                onChange={uploadDocuments}
                disabled={docUploading}
              />
              {documentUrls.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {documentUrls.map((url, i) => (
                    <div key={i} className="relative group">
                      <a href={url} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 rounded-lg border bg-muted overflow-hidden">
                        <img src={url} alt="" className="object-cover w-full h-full" />
                      </a>
                      <button
                        type="button"
                        onClick={() => removeDocument(i)}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-90 hover:opacity-100"
                        aria-label="Oʻchirish"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saqlanmoqda...' : 'Yuridik maʼlumotlarni saqlash'}
            </Button>
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
                1) Telegramda Oline Bozor botini oching va <b>/code</b> yuboring (kod olish uchun).<br />
                2) Bot bergan 6 belgili kodni quyida kiriting.
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
            {shop?.chatWithSellerEnabled !== false
              ? "Chat yoqilganda xaridorlar sizga mahsulot haqida yozishi mumkin. O‘chirsangiz, yangi xabarlar qabul qilinmaydi (oldingi suhbatlar ko‘rinadi)."
              : "Platforma administratori chatni o‘chirgan. Chatni yoqish imkoni yo‘q — admin qayta yoqguncha kuting."}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="chat-toggle"
              checked={chatEnabled}
              onChange={(e) => toggleChat(e.target.checked)}
              disabled={chatSaving || shop === null || shop?.chatWithSellerEnabled === false}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <Label htmlFor="chat-toggle" className={shop?.chatWithSellerEnabled === false ? 'text-muted-foreground cursor-not-allowed' : 'cursor-pointer text-sm font-medium'}>
              Chatni qabul qilish — xaridorlar sizga yozishi mumkin
            </Label>
          </div>
          {shop?.chatWithSellerEnabled === false && <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">Admin chatni platformada o‘chirgan</p>}
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
                <label className="text-sm font-medium">Tuman va mahalla</label>
                <Input placeholder="Tuman va mahalla" value={pickup?.district ?? ''} onChange={(e) => setPickup((p) => ({ ...p, district: e.target.value }))} className="mt-1" />
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
