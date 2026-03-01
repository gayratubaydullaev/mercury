'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { ImageIcon, Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';

type Banner = {
  id: string;
  image: string;
  href: string;
  external: boolean;
  title: string | null;
  sortOrder: number;
  isActive: boolean;
};

export default function AdminBannersPage() {
  const [list, setList] = useState<Banner[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState({ image: '', href: '/catalog', external: false, title: '', sortOrder: 0 });
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

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !form.image.trim() || !form.href.trim()) return;
    setLoading(true);
    apiFetch(`${API_URL}/admin/banners`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        image: form.image.trim(),
        href: form.href.trim(),
        external: form.external,
        title: form.title.trim() || undefined,
        sortOrder: form.sortOrder,
      }),
    })
      .then(() => {
        setForm({ image: '', href: '/catalog', external: false, title: '', sortOrder: 0 });
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
    apiFetch(`${API_URL}/admin/banners/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        image: form.image.trim() || undefined,
        href: form.href.trim() || undefined,
        external: form.external,
        title: form.title.trim() || null,
        sortOrder: form.sortOrder,
      }),
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

  if (!token) return <p>Kirish kerak</p>;
  if (list === null) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <ImageIcon className="h-7 w-7" />
        Bannerlar
      </h1>
      <p className="text-muted-foreground">Yaratish, tahrirlash, oʻchirish va koʻrsatishni yashirish</p>
      {loadError && <p className="text-destructive text-sm">{loadError}</p>}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Yangi banner</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={editing ? update : create} className="space-y-3 max-w-xl">
            <div>
              <label className="text-sm font-medium">Rasm URL</label>
              <Input value={form.image} onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))} placeholder="https://..." required={!editing} />
            </div>
            <div>
              <label className="text-sm font-medium">Havola (href)</label>
              <Input value={form.href} onChange={(e) => setForm((f) => ({ ...f, href: e.target.value }))} placeholder="/catalog" required />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="external" checked={form.external} onChange={(e) => setForm((f) => ({ ...f, external: e.target.checked }))} />
              <label htmlFor="external" className="text-sm">Tashqi havola (yangi oynada)</label>
            </div>
            <div>
              <label className="text-sm font-medium">Sarlavha (ixtiyoriy)</label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Banner sarlavhasi" />
            </div>
            <div>
              <label className="text-sm font-medium">Tartib (sortOrder)</label>
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>{editing ? 'Saqlash' : 'Qoʻshish'}</Button>
              {editing && <Button type="button" variant="outline" onClick={() => { setEditing(null); setForm({ image: '', href: '/catalog', external: false, title: '', sortOrder: 0 }); }}>Bekor qilish</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="font-semibold">Barcha bannerlar</h2>
        {list.length === 0 && !loadError && <p className="text-muted-foreground">Bannerlar yoʻq. Yuqoridan qoʻshing.</p>}
        {list.map((b) => (
          <Card key={b.id}>
            <CardContent className="p-4 flex flex-wrap items-center gap-4">
              <div className="relative w-32 h-16 rounded overflow-hidden bg-muted shrink-0">
                <Image src={b.image} alt={b.title ?? ''} fill className="object-cover" sizes="128px" unoptimized />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{b.title || b.href}</p>
                <p className="text-sm text-muted-foreground truncate">{b.href} {b.external && '(tashqi)'}</p>
                <p className="text-xs text-muted-foreground">Tartib: {b.sortOrder} {!b.isActive && '· Yashirin'}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setEditing(b); setForm({ image: b.image, href: b.href, external: b.external, title: b.title ?? '', sortOrder: b.sortOrder }); }}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" onClick={() => toggleActive(b)} title={b.isActive ? 'Yashirish' : 'Koʻrsatish'}>{b.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                <Button size="sm" variant="outline" className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
