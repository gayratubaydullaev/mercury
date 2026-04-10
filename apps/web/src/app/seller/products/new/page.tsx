'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { API_URL } from '@/lib/utils';
import { apiFetch, getCsrfToken } from '@/lib/api';
import { ArrowLeft, Upload, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';

type Category = { id: string; name: string; slug: string; parentId: string | null; children?: Category[] };

export default function NewProductPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [comparePrice, setComparePrice] = useState('');
  const [stock, setStock] = useState('0');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  /** Варианты: массив { name: "O'lcham", values: "S, M, L" } для отображения в форме */
  const [optionsRows, setOptionsRows] = useState<{ name: string; values: string }[]>([]);
  /** Har bir variant uchun qoldiq va ixtiyoriy rasm */
  const [variantRows, setVariantRows] = useState<{ options: Record<string, string>; stock: number; imageUrl: string }[]>([]);
  /** Xususiyatlar (kalit–qiymat) */
  const [specsRows, setSpecsRows] = useState<{ key: string; value: string }[]>([]);
  const [unit, setUnit] = useState('');

  useEffect(() => {
    if (!token) return;
    apiFetch(`${API_URL}/categories?parentId=null`)
      .then((r) => r.json())
      .then((roots: Category[]) => {
        setCategories(roots ?? []);
      })
      .catch(() => setCategories([]));
  }, [token]);

  useEffect(() => {
    if (!categories.length) return;
    setCategoryId((prev) => {
      if (prev) return prev;
      const firstChild = categories.flatMap((r) => r.children ?? []).find(Boolean);
      return firstChild?.id ?? '';
    });
  }, [categories]);

  const leafCategories = categories.flatMap((c) => (c.children ?? []));

  /** Barcha variant kombinatsiyalarini yaratish (O'lcham × Rang va hokazo) */
  const generateAllVariants = () => {
    const names = optionsRows.map((r) => r.name.trim()).filter(Boolean);
    const valueLists = optionsRows
      .filter((r) => r.name.trim())
      .map((r) => r.values.split(',').map((v) => v.trim()).filter(Boolean));
    if (valueLists.some((arr) => !arr.length)) {
      toast.error('Barcha variantlarda kamida bitta qiymat kiriting');
      return;
    }
    function cartesian<T>(arrays: T[][]): T[][] {
      if (arrays.length === 0) return [[]];
      const [first, ...rest] = arrays;
      const restProduct = cartesian(rest);
      return first.flatMap((v) => restProduct.map((p) => [v, ...p]));
    }
    const combos = cartesian(valueLists);
    const newRows = combos.map((values) => {
      const options: Record<string, string> = {};
      names.forEach((name, i) => {
        options[name] = values[i] as string;
      });
      return { options, stock: 0, imageUrl: '' };
    });
    setVariantRows(newRows);
    toast.success(`${newRows.length} ta variant yaratildi. Har biriga qoldiq kiriting.`);
  };

  const uploadVariantImage = async (e: React.ChangeEvent<HTMLInputElement>, variantIndex: number) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const csrf = await getCsrfToken();
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (csrf) headers['x-csrf-token'] = csrf;
      const r = await fetch(`${API_URL}/upload/image`, {
        method: 'POST',
        headers,
        body: form,
        credentials: 'include',
      });
      const data = await r.json().catch(() => ({}));
      if (data?.url) {
        setVariantRows((prev) => prev.map((v, i) => (i === variantIndex ? { ...v, imageUrl: data.url } : v)));
        toast.success('Variant rasmi yuklandi');
      } else toast.error(data?.message ?? 'Rasm yuklanmadi');
    } catch {
      toast.error('Rasm yuklashda xatolik');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const moveImage = (index: number, direction: 'left' | 'right') => {
    setImageUrls((prev) => {
      const next = [...prev];
      const target = direction === 'left' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const moveImageToFirst = (index: number) => {
    if (index <= 0) return;
    setImageUrls((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      next.unshift(removed);
      return next;
    });
    toast.success('Birinchi rasm yangilandi');
  };

  const uploadMultipleImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !token) return;
    const fileList = Array.from(files).slice(0, 10);
    setUploading(true);
    let added = 0;
    const csrf = await getCsrfToken();
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (csrf) headers['x-csrf-token'] = csrf;
    for (const file of fileList) {
      try {
        const form = new FormData();
        form.append('file', file);
        const r = await fetch(`${API_URL}/upload/image`, { method: 'POST', headers, body: form, credentials: 'include' });
        const data = await r.json().catch(() => ({}));
        if (data?.url) {
          setImageUrls((prev) => [...prev, data.url]);
          added++;
        }
      } catch {
        /* skip failed */
      }
    }
    setUploading(false);
    e.target.value = '';
    if (added > 0) toast.success(`${added} ta rasm yuklandi`);
    if (added < fileList.length) toast.error(`Baʼzilari yuklanmadi: ${fileList.length - added} ta`);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const priceNum = parseFloat(price.replace(/\s/g, '').replace(',', '.'));
    const compareNum = comparePrice ? parseFloat(comparePrice.replace(/\s/g, '').replace(',', '.')) : undefined;
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error('Narxni toʻgʻri kiriting (musbat son)');
      return;
    }
    const compareVal = compareNum != null && !isNaN(compareNum) ? compareNum : null;
    if (compareVal != null && compareVal < priceNum) {
      toast.error('Solishtirish narxi asosiy narxdan kam boʻlmasligi kerak');
      return;
    }
    if (!title.trim()) {
      toast.error('Mahsulot nomini kiriting');
      return;
    }
    if (!description.trim()) {
      toast.error('Tavsifni kiriting');
      return;
    }
    if (!categoryId) {
      toast.error('Kategoriyani tanlang (ostkategoriyani tanlang)');
      return;
    }
    if (!imageUrls.length) {
      toast.error('Kamida bitta rasm yuklang');
      return;
    }
    setLoading(true);
    const options: Record<string, string[]> = {};
    optionsRows.forEach((row) => {
      const key = row.name.trim();
      if (!key) return;
      const vals = row.values.split(',').map((v) => v.trim()).filter(Boolean);
      if (vals.length) options[key] = vals;
    });
    const specs = specsRows.length
      ? Object.fromEntries(specsRows.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value.trim()]))
      : undefined;
    const variants =
      variantRows.length > 0
        ? variantRows.map((v) => ({
            options: v.options,
            stock: Math.max(0, v.stock),
            imageUrl: v.imageUrl.trim() || undefined,
          }))
        : undefined;
    apiFetch(`${API_URL}/products`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim(),
        price: priceNum,
        comparePrice: compareNum != null && !isNaN(compareNum) ? compareNum : undefined,
        stock: variantRows.length > 0 ? variantRows.reduce((s, v) => s + v.stock, 0) : Math.max(0, parseInt(stock, 10) || 0),
        sku: sku.trim() || undefined,
        categoryId,
        imageUrls: imageUrls.length ? imageUrls : undefined,
        options: Object.keys(options).length ? options : undefined,
        specs: specs && Object.keys(specs).length ? specs : undefined,
        unit: unit.trim() || undefined,
        variants,
      }),
    })
      .then((r) => r.json())
      .then(() => {
        toast.success('Tovar qoʻshildi');
        router.push('/seller/products');
      })
      .catch((err) => {
        const msg = err?.message ?? err?.response?.data?.message ?? (typeof err === 'string' ? err : 'Tovar saqlanmadi');
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  };

  if (!token) return <DashboardAuthGate />;

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl space-y-6 xl:max-w-5xl 2xl:max-w-6xl">
      <DashboardPageHeader
        eyebrow="Sotuvchi kabineti"
        title="Yangi tovar"
        description="Nomi, narx, rasmlar va ixtiyoriy variantlar — keyin roʻyxatda koʻrinadi."
      >
        <Button variant="outline" size="sm" className="min-h-[40px] touch-manipulation" asChild>
          <Link href="/seller/products">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Tovarlar
          </Link>
        </Button>
      </DashboardPageHeader>

      <form onSubmit={submit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Asosiy maʼlumot</CardTitle>
            <p className="text-sm text-muted-foreground font-normal mt-1">Nomi, tavsif va kategoriya</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Mahsulot nomi *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Masalan: Erkaklar koʻylagi, M"
                className="mt-1"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Tavsif *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mahsulot haqida qisqacha: material, oʻlchamlar, qoʻllanma"
                className="mt-1 w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Kategoriya *</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">Ostkategoriyani tanlang</option>
                {leafCategories.map((c) => {
                  const parent = categories.find((p) => p.id === c.parentId);
                  return (
                    <option key={c.id} value={c.id}>
                      {parent ? `${parent.name} → ` : ''}{c.name}
                    </option>
                  );
                })}
                {leafCategories.length === 0 && categories.length > 0 && (
                  <option value="" disabled>Ostkategoriyalar yoʻq. Avvalo admin toifalarni yaratadi.</option>
                )}
              </select>
              <p className="text-xs text-muted-foreground mt-1">Faqat ostkategoriya (asosiy emas)</p>
            </div>
            <div>
              <label className="text-sm font-medium">Birlik (ixtiyoriy)</label>
              <p className="text-xs text-muted-foreground mb-1">Narx qanday birlikda — dona, kg, m², m, l. Masalan qurilish yoki oziq-ovqat uchun.</p>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Dona (sukut)</option>
                <option value="dona">Dona</option>
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="l">l</option>
                <option value="ml">ml</option>
                <option value="m2">m²</option>
                <option value="m">m</option>
                <option value="paket">Paket</option>
                <option value="quti">Quti</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rasmlar</CardTitle>
            <p className="text-sm text-muted-foreground font-normal mt-1">Birinchi rasm asosiy koʻrinadi. Kamida bitta rasm talab qilinadi (10 gacha).</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 items-start">
              {imageUrls.map((url, i) => (
                <div key={i} className="relative group w-24 h-24 rounded-lg border overflow-hidden bg-muted shrink-0">
                  <Image src={url} alt="" width={96} height={96} className="w-full h-full object-cover" unoptimized />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveImage(i, 'left')}
                      disabled={i === 0}
                      className="p-1 rounded bg-background/90 text-foreground disabled:opacity-40"
                      aria-label="Chapga"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => moveImageToFirst(i)}
                        className="p-1 rounded bg-primary text-primary-foreground text-xs whitespace-nowrap"
                      >
                        Asosiy
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => moveImage(i, 'right')}
                      disabled={i === imageUrls.length - 1}
                      className="p-1 rounded bg-background/90 text-foreground disabled:opacity-40"
                      aria-label="Oʻngga"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white"
                      aria-label="Oʻchirish"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  {i === 0 && (
                    <span className="absolute bottom-0 left-0 right-0 bg-primary/90 text-primary-foreground text-[10px] text-center py-0.5">Asosiy</span>
                  )}
                </div>
              ))}
              <label className="w-24 h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition shrink-0">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  multiple
                  onChange={uploadMultipleImages}
                  disabled={uploading}
                />
                {uploading ? (
                  <span className="text-xs px-2 text-center">Yuklanmoqda...</span>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                    <span className="text-[10px] text-muted-foreground text-center px-1">Bir yoki bir nechta</span>
                  </>
                )}
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Narx va mavjudlik</CardTitle>
            <p className="text-sm text-muted-foreground font-normal mt-1">Narx, qoldiq va ixtiyoriy variantlar</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Narx (soʻm) *</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Masalan 99900"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Solishtirish narxi (soʻm)</label>
                <p className="text-xs text-muted-foreground mt-0.5">Eski narx — chegirma % hisoblash uchun (ixtiyoriy)</p>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={comparePrice}
                  onChange={(e) => setComparePrice(e.target.value)}
                  placeholder="Masalan 150000"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Qoldiq</label>
                <p className="text-xs text-muted-foreground mt-0.5">Variantlar boʻlsa, ular boʻyicha hisoblanadi</p>
                <Input
                  type="number"
                  min={0}
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">SKU (ixtiyoriy)</label>
                <p className="text-xs text-muted-foreground mt-0.5">Articul yoki ichki kod — inventarizatsiya uchun</p>
                <Input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Masalan: KOYL-001"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Variantlar (ixtiyoriy)</label>
              <p className="text-xs text-muted-foreground mb-2">Masalan: Oʻlcham — S, M, L yoki Rang — Qora, Oq. Bitta umumiy qoldiq tovar uchun.</p>
              {optionsRows.map((row, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <Input
                    placeholder="Nomi (Oʻlcham, Rang...)"
                    value={row.name}
                    onChange={(e) => setOptionsRows((prev) => prev.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))}
                    className="flex-1 max-w-[140px]"
                  />
                  <Input
                    placeholder="Qiymatlar (vergul bilan)"
                    value={row.values}
                    onChange={(e) => setOptionsRows((prev) => prev.map((r, i) => i === idx ? { ...r, values: e.target.value } : r))}
                    className="flex-1"
                  />
                  <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground" onClick={() => setOptionsRows((prev) => prev.filter((_, i) => i !== idx))} aria-label="Oʻchirish">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setOptionsRows((prev) => [...prev, { name: '', values: '' }])}>
                + Variant turi qoʻshish
              </Button>
            </div>
            {optionsRows.some((r) => r.name.trim() && r.values.split(',').map((v) => v.trim()).filter(Boolean).length > 0) && (
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <label className="text-sm font-medium">Variantlar boʻyicha qoldiq va rasm</label>
                  <Button type="button" variant="outline" size="sm" onClick={generateAllVariants}>
                    Barcha kombinatsiyalarni yarat
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-2">Har bir kombinatsiya (masalan S–Qora, M–Qora) uchun qoldiq va ixtiyoriy rasm.</p>
                {variantRows.map((vr, idx) => {
                  const comboLabel = optionsRows.filter((r) => r.name.trim()).map((row) => vr.options[row.name] ?? '—').join(' · ');
                  return (
                  <div key={idx} className="flex flex-wrap items-end gap-2 mb-2 p-3 rounded-lg border bg-muted/30">
                    {comboLabel && (
                      <span className="w-full text-xs font-medium text-muted-foreground mb-0.5">{comboLabel}</span>
                    )}
                    {optionsRows.filter((r) => r.name.trim()).map((row) => {
                      const vals = row.values.split(',').map((v) => v.trim()).filter(Boolean);
                      if (!vals.length) return null;
                      return (
                        <div key={row.name} className="flex flex-col">
                          <label className="text-xs text-muted-foreground">{row.name}</label>
                          <select
                            value={vr.options[row.name] ?? vals[0]}
                            onChange={(e) =>
                              setVariantRows((prev) =>
                                prev.map((v, i) => (i === idx ? { ...v, options: { ...v.options, [row.name]: e.target.value } } : v))
                              )
                            }
                            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm min-w-[80px]"
                          >
                            {vals.map((val) => (
                              <option key={val} value={val}>{val}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                    <div className="flex flex-col">
                      <label className="text-xs text-muted-foreground">Qoldiq</label>
                      <Input
                        type="number"
                        min={0}
                        value={vr.stock}
                        onChange={(e) => setVariantRows((prev) => prev.map((v, i) => (i === idx ? { ...v, stock: parseInt(e.target.value, 10) || 0 } : v)))}
                        className="w-20"
                      />
                    </div>
                    <div className="flex flex-col flex-1 min-w-[140px]">
                      <label className="text-xs text-muted-foreground">Variant rasmi</label>
                      <div className="flex gap-1 items-center">
                        <Input
                          placeholder="URL yoki yuklang"
                          value={vr.imageUrl}
                          onChange={(e) => setVariantRows((prev) => prev.map((v, i) => (i === idx ? { ...v, imageUrl: e.target.value } : v)))}
                          className="text-sm flex-1 min-w-0"
                        />
                        <label className="shrink-0 cursor-pointer">
                          <input type="file" accept="image/*" className="sr-only" onChange={(e) => uploadVariantImage(e, idx)} disabled={uploading} />
                          <span className="inline-flex items-center justify-center h-10 px-2 rounded-md border border-input bg-background text-xs font-medium hover:bg-accent">Yuklash</span>
                        </label>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground" onClick={() => setVariantRows((prev) => prev.filter((_, i) => i !== idx))} aria-label="Oʻchirish">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const opts: Record<string, string> = {};
                    optionsRows.forEach((r) => {
                      const key = r.name.trim();
                      if (!key) return;
                      const vals = r.values.split(',').map((v) => v.trim()).filter(Boolean);
                      const first = vals[0];
                      if (first) opts[key] = first;
                    });
                    setVariantRows((prev) => [...prev, { options: opts, stock: 0, imageUrl: '' }]);
                  }}
                >
                  + Variant qator qoʻshish
                </Button>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Xususiyatlar (ixtiyoriy)</label>
              <p className="text-xs text-muted-foreground mb-2">Masalan: Material — Paxta, Ogʻirlik — 200g</p>
              {specsRows.map((row, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <Input
                    placeholder="Nomi"
                    value={row.key}
                    onChange={(e) => setSpecsRows((prev) => prev.map((r, i) => (i === idx ? { ...r, key: e.target.value } : r)))}
                    className="flex-1 max-w-[140px]"
                  />
                  <Input
                    placeholder="Qiymat"
                    value={row.value}
                    onChange={(e) => setSpecsRows((prev) => prev.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r)))}
                    className="flex-1"
                  />
                  <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground" onClick={() => setSpecsRows((prev) => prev.filter((_, i) => i !== idx))} aria-label="Oʻchirish">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setSpecsRows((prev) => [...prev, { key: '', value: '' }])}>
                + Xususiyat qoʻshish
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>{loading ? 'Saqlanmoqda...' : 'Saqlash'}</Button>
          <Button type="button" variant="outline" asChild><Link href="/seller/products">Bekor qilish</Link></Button>
        </div>
      </form>
    </div>
  );
}
