'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { FolderTree, Plus, Pencil, Trash2 } from 'lucide-react';

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  children: Category[];
};

export default function AdminCategoriesPage() {
  const [list, setList] = useState<Category[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string; slug: string; description: string } | null>(null);
  const [newCat, setNewCat] = useState<{ name: string; slug: string; description: string; parentId: string }>({ name: '', slug: '', description: '', parentId: '' });
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const load = () => {
    if (!token) return;
    setLoadError('');
    apiFetch(`${API_URL}/admin/categories`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { setList(Array.isArray(data) ? data : []); setLoadError(''); })
      .catch(() => { setList([]); setLoadError('API ga ulanishda xatolik. Serverni ishga tushiring (pnpm run dev).'); });
  };

  useEffect(() => {
    load();
  }, [token]);

  const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newCat.name.trim()) return;
    setLoading(true);
    apiFetch(`${API_URL}/admin/categories`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: newCat.name.trim(),
        slug: newCat.slug.trim() || slugify(newCat.name),
        description: newCat.description.trim() || undefined,
        parentId: newCat.parentId || undefined,
      }),
    })
      .then(() => {
        setNewCat({ name: '', slug: '', description: '', parentId: '' });
        toast.success('Toifa qoʻshildi');
      })
      .then(load)
      .catch(() => toast.error('Toifa qoʻshilmadi'))
      .finally(() => setLoading(false));
  };

  const update = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editing) return;
    setLoading(true);
    apiFetch(`${API_URL}/admin/categories/${editing.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: editing.name.trim(),
        slug: editing.slug.trim() || slugify(editing.name),
        description: editing.description.trim() || undefined,
      }),
    })
      .then(() => {
        setEditing(null);
        toast.success('Toifa saqlandi');
      })
      .then(load)
      .catch(() => toast.error('Saqlashda xatolik'))
      .finally(() => setLoading(false));
  };

  const remove = (id: string) => {
    if (!token || !confirm('Oʻchirishni xohlaysizmi?')) return;
    apiFetch(`${API_URL}/admin/categories/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        load();
        toast.success('Toifa oʻchirildi');
      })
      .catch((err) => toast.error(err?.message ?? 'Oʻchirishda xatolik'));
  };

  if (!token) return <p>Kirish kerak</p>;
  if (list === null) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold flex flex-wrap items-center gap-2">
        <FolderTree className="h-7 w-7" />
        Toifalar
      </h1>
      {loadError && <p className="text-destructive text-sm">{loadError}</p>}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Yangi toifa</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={create} className="space-y-3 max-w-md">
            <div>
              <label className="text-sm font-medium">Nomi</label>
              <Input value={newCat.name} onChange={(e) => setNewCat((c) => ({ ...c, name: e.target.value, slug: c.slug || slugify(e.target.value) }))} placeholder="Nomi" required />
            </div>
            <div>
              <label className="text-sm font-medium">Slug</label>
              <Input value={newCat.slug} onChange={(e) => setNewCat((c) => ({ ...c, slug: e.target.value }))} placeholder="slug" />
            </div>
            <div>
              <label className="text-sm font-medium">Tavsif</label>
              <Input value={newCat.description} onChange={(e) => setNewCat((c) => ({ ...c, description: e.target.value }))} placeholder="Ixtiyoriy" />
            </div>
            <div>
              <label className="text-sm font-medium">Ostkategoriya (asosiy uchun boʻsh)</label>
              <select value={newCat.parentId} onChange={(e) => setNewCat((c) => ({ ...c, parentId: e.target.value }))} className="w-full rounded-md border px-3 py-2 text-sm">
                <option value="">— Asosiy toifa —</option>
                {list.filter((c) => !c.parentId).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={loading}>Qoʻshish</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Barcha toifalar</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {list.map((c) => (
              <li key={c.id} className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap p-2 rounded-lg bg-muted/50">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.slug}</span>
                  {editing?.id === c.id ? (
                    <form onSubmit={update} className="flex gap-2 flex-wrap items-center ml-2">
                      <Input value={editing.name} onChange={(e) => setEditing((x) => x && { ...x, name: e.target.value })} className="w-40" />
                      <Input value={editing.slug} onChange={(e) => setEditing((x) => x && { ...x, slug: e.target.value })} className="w-32" placeholder="slug" />
                      <Button type="submit" size="sm" disabled={loading}>Saqlash</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)}>Bekor</Button>
                    </form>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setEditing({ id: c.id, name: c.name, slug: c.slug, description: c.description ?? '' })}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(c.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </>
                  )}
                </div>
                {c.children?.length ? (
                  <ul className="pl-4 border-l-2 border-muted">
                    {c.children.map((ch) => (
                      <li key={ch.id} className="flex items-center gap-2 py-1">
                        <span>{ch.name}</span>
                        <span className="text-xs text-muted-foreground">{ch.slug}</span>
                        {editing?.id === ch.id ? (
                          <form onSubmit={update} className="flex gap-2 flex-wrap items-center">
                            <Input value={editing.name} onChange={(e) => setEditing((x) => x && { ...x, name: e.target.value })} className="w-40" />
                            <Input value={editing.slug} onChange={(e) => setEditing((x) => x && { ...x, slug: e.target.value })} className="w-32" />
                            <Button type="submit" size="sm" disabled={loading}>Saqlash</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)}>Bekor</Button>
                          </form>
                        ) : (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => setEditing({ id: ch.id, name: ch.name, slug: ch.slug, description: ch.description ?? '' })}><Pencil className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => remove(ch.id)} className="text-destructive"><Trash2 className="h-3 w-3" /></Button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
          {list.length === 0 && <p className="text-muted-foreground">Toifalar yoʻq. Yuqoridan qoʻshing.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
