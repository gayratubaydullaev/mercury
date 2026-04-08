'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/utils';
import { apiFetch, getCsrfToken } from '@/lib/api';
import { ImageIcon, Plus, Pencil, Trash2, Eye, EyeOff, Upload } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';

type Banner = {
  id: string;
  image: string;
  href: string;
  external: boolean;
  title: string | null;
  sortOrder: number;
  isActive: boolean;
  displaySeconds: number | null;
  startsAt: string | null;
  endsAt: string | null;
};

const defaultForm = () => ({
  image: '',
  href: '/catalog',
  external: false,
  title: '',
  sortOrder: 0,
  displaySeconds: '' as number | '',
  startsAt: '',
  endsAt: '',
});

/** ISO string to datetime-local value (YYYY-MM-DDTHH:mm). */
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

/** datetime-local value to ISO string for API. */
function fromDatetimeLocal(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

export default function AdminBannersPage() {
  const [list, setList] = useState<Banner[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState(defaultForm);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const load = () => {
    if (!token) return;
    setLoadError('');
    apiFetch(`${API_URL}/admin/banners`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setList(Array.isArray(d) ? d : []); setLoadError(''); })
      .catch(() => { setList([]); setLoadError('API ga ulanishda xatolik.'); });
  };

  useEffect(() => {
    load();
  }, [token]);

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const csrf = await getCsrfToken();
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (csrf) headers['x-csrf-token'] = csrf;
      const r = await fetch(`${API_URL}/upload/image`, {
        method: 'POST',
        headers,
        body: formData,
        credentials: 'include',
      });
      const data = await r.json().catch(() => ({}));
      if (data?.url) {
        setForm((f) => ({ ...f, image: data.url }));
        toast.success('Rasm yuklandi');
      } else toast.error(data?.message ?? 'Rasm yuklanmadi');
    } catch {
      toast.error('Rasm yuklashda xatolik');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !form.image.trim() || !form.href.trim()) return;
    setLoading(true);
    const payload = {
      image: form.image.trim(),
      href: form.href.trim(),
      external: form.external,
      title: form.title.trim() || undefined,
      sortOrder: Number(form.sortOrder) || 0,
      displaySeconds: form.displaySeconds !== '' ? Number(form.displaySeconds) : undefined,
      startsAt: fromDatetimeLocal(form.startsAt),
      endsAt: fromDatetimeLocal(form.endsAt),
    };
    apiFetch(`${API_URL}/admin/banners`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
      .then(() => {
        setForm(defaultForm());
        toast.success('Banner qoʻshildi');
        load();
      })
      .catch(() => toast.error('Banner qoʻshilmadi'))
      .finally(() => setLoading(false));
  };

  const update = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editing) return;
    setLoading(true);
    const payload: Record<string, unknown> = {
      image: form.image.trim() || undefined,
      href: form.href.trim() || undefined,
      external: form.external,
      title: form.title.trim() || null,
      sortOrder: Number(form.sortOrder) || 0,
      displaySeconds: form.displaySeconds === '' ? null : (Number(form.displaySeconds) || null),
      startsAt: form.startsAt ? fromDatetimeLocal(form.startsAt) ?? null : null,
      endsAt: form.endsAt ? fromDatetimeLocal(form.endsAt) ?? null : null,
    };
    apiFetch(`${API_URL}/admin/banners/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
      .then(() => {
        setEditing(null);
        toast.success('Banner saqlandi');
        load();
      })
      .catch(() => toast.error('Saqlashda xatolik'))
      .finally(() => setLoading(false));
  };

  const remove = (id: string) => {
    if (!token || !confirm('Bannerni oʻchirishni xohlaysizmi?')) return;
    apiFetch(`${API_URL}/admin/banners/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        load();
        toast.success('Banner oʻchirildi');
      })
      .catch(() => toast.error('Oʻchirishda xatolik'));
  };

  const toggleActive = (b: Banner) => {
    if (!token) return;
    apiFetch(`${API_URL}/admin/banners/${b.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isActive: !b.isActive }),
    })
      .then(() => {
        load();
        toast.success(b.isActive ? 'Banner yashirildi' : 'Banner koʻrsatildi');
      })
      .catch(() => toast.error('Oʻzgartirish amalga oshmadi'));
  };

  if (!token) return <DashboardAuthGate />;
  if (list === null) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <DashboardPageHeader
        eyebrow="Platforma"
        title="Bannerlar"
        description="Bosh sahifa karuseli: yaratish, tahrirlash, oʻchirish va koʻrsatishni boshqarish."
      />
      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base sm:text-lg"><Plus className="h-5 w-5 shrink-0" /> Yangi banner</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={editing ? update : create} className="space-y-3 max-w-xl">
            <div>
              <label className="text-sm font-medium">Rasm</label>
              <div className="mt-1 flex flex-wrap gap-2 items-center">
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="sr-only" onChange={uploadImage} disabled={uploading} />
                  <Button type="button" variant="outline" className="min-h-[40px] touch-manipulation" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2 inline" />
                      {uploading ? 'Yuklanmoqda…' : 'Foto yuklash'}
                    </span>
                  </Button>
                </label>
                <span className="text-muted-foreground text-sm">yoki URL</span>
              </div>
              <Input className="min-h-[40px] mt-1" value={form.image} onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))} placeholder="https://... yoki yuklang" required={!editing} />
              {form.image && (
                <div className="relative mt-2 w-full max-w-[200px] aspect-video rounded-lg overflow-hidden bg-muted">
                  <Image src={form.image} alt="" fill className="object-cover" sizes="200px" unoptimized />
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Havola (href)</label>
              <Input className="min-h-[40px] mt-1" value={form.href} onChange={(e) => setForm((f) => ({ ...f, href: e.target.value }))} placeholder="/catalog" required />
            </div>
            <div className="flex items-center gap-2 min-h-[40px]">
              <input type="checkbox" id="external" checked={form.external} onChange={(e) => setForm((f) => ({ ...f, external: e.target.checked }))} className="rounded border-input" />
              <label htmlFor="external" className="text-sm touch-manipulation">Tashqi havola (yangi oynada)</label>
            </div>
            <div>
              <label className="text-sm font-medium">Sarlavha (ixtiyoriy)</label>
              <Input className="min-h-[40px] mt-1" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Banner sarlavhasi" />
            </div>
            <div>
              <label className="text-sm font-medium">Tartib (sortOrder)</label>
              <Input type="number" className="min-h-[40px] mt-1" min={0} value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Vaqt (sekund) — har bir slayd qancha koʻrsatilsin (1–60)</label>
              <Input type="number" className="min-h-[40px] mt-1" min={1} max={60} value={form.displaySeconds === '' ? '' : form.displaySeconds} onChange={(e) => setForm((f) => ({ ...f, displaySeconds: e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0 }))} placeholder="5 (default)" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Koʻrsatishdan boshlash (sana va vaqt)</label>
                <Input type="datetime-local" className="min-h-[40px] mt-1" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">Shu sanadan keyin yopish (deaktivatsiya)</label>
                <Input type="datetime-local" className="min-h-[40px] mt-1" value={form.endsAt} onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={loading} className="min-h-[40px] touch-manipulation">{editing ? 'Saqlash' : 'Qoʻshish'}</Button>
              {editing && <Button type="button" variant="outline" className="min-h-[40px] touch-manipulation" onClick={() => { setEditing(null); setForm(defaultForm()); }}>Bekor qilish</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="font-semibold text-base sm:text-lg">Barcha bannerlar</h2>
        {list.length === 0 && !loadError && <p className="text-muted-foreground">Bannerlar yoʻq. Yuqoridan qoʻshing.</p>}
        {list.map((b) => (
          <Card key={b.id}>
            <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
              <div className="relative w-full sm:w-32 h-20 sm:h-16 rounded-lg overflow-hidden bg-muted shrink-0">
                <Image src={b.image} alt={b.title ?? ''} fill className="object-cover" sizes="(max-width:640px) 100vw, 128px" unoptimized />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{b.title || b.href}</p>
                <p className="text-sm text-muted-foreground truncate">{b.href} {b.external && '(tashqi)'}</p>
                <p className="text-xs text-muted-foreground">Tartib: {b.sortOrder} {b.displaySeconds != null && `· ${b.displaySeconds}s`} {!b.isActive && '· Yashirin'}</p>
                {(b.startsAt || b.endsAt) && <p className="text-xs text-muted-foreground">{b.startsAt && `Boshlash: ${new Date(b.startsAt).toLocaleString()}`} {b.startsAt && b.endsAt && ' · '} {b.endsAt && `Tugash: ${new Date(b.endsAt).toLocaleString()}`}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" className="min-h-[40px] min-w-[40px] touch-manipulation" onClick={() => { setEditing(b); setForm({ image: b.image, href: b.href, external: b.external, title: b.title ?? '', sortOrder: b.sortOrder, displaySeconds: b.displaySeconds ?? '', startsAt: toDatetimeLocal(b.startsAt), endsAt: toDatetimeLocal(b.endsAt) }); }}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" className="min-h-[40px] min-w-[40px] touch-manipulation" onClick={() => toggleActive(b)} title={b.isActive ? 'Yashirish' : 'Koʻrsatish'}>{b.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                <Button size="sm" variant="outline" className="min-h-[40px] min-w-[40px] touch-manipulation text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
