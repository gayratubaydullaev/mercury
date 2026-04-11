'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  PackagePlus,
  Pencil,
  Loader2,
  Search,
  Boxes,
  ScanLine,
  Camera,
  ImagePlus,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { API_URL, formatPrice, cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { DashboardPanel } from '@/components/dashboard/dashboard-panel';
import { usePublicSettings } from '@/contexts/public-settings-context';

type CategoryRoot = {
  id: string;
  name: string;
  children?: { id: string; name: string }[];
};

type WarehouseProduct = {
  id: string;
  title: string;
  description: string;
  price: string;
  stock: number;
  sku?: string | null;
  isActive: boolean;
  isModerated: boolean;
  options?: unknown;
  category?: { id: string; name: string };
  images: { url: string }[];
  variants: {
    id: string;
    options: unknown;
    stock: number;
    sku?: string | null;
    priceOverride: string | null;
  }[];
};

function variantLabel(options: unknown): string {
  if (options && typeof options === 'object' && !Array.isArray(options)) {
    return Object.entries(options as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(', ');
  }
  return options != null ? String(options) : '';
}

function flattenSubcategories(roots: CategoryRoot[]): { id: string; label: string }[] {
  return roots.flatMap((c) => (c.children ?? []).map((ch) => ({ id: ch.id, label: `${c.name} → ${ch.name}` })));
}

type PosWarehouseSectionProps = {
  token: string;
  onCatalogChanged: () => void;
  /** Tashqi skaner: ushbu id bo‘yicha qatorni ajratib, tahrirlashni ochish */
  focusProductId: string | null;
  onFocusConsumed: () => void;
  /** TSD: kamera skaneri — bazada yoʻq kod; forma ochiladi, SKU toʻldiriladi */
  tsdScanSku: string | null;
  onTsdScanSkuConsumed: () => void;
  /** SKU / shtrix-kodni qo‘lda kiritib, kamera bilan bir xil qidiruv (topilsa — tahrir) */
  onLookupBySku?: (sku: string) => void | Promise<void>;
};

export function PosWarehouseSection({
  token,
  onCatalogChanged,
  focusProductId,
  onFocusConsumed,
  tsdScanSku,
  onTsdScanSkuConsumed,
  onLookupBySku,
}: PosWarehouseSectionProps) {
  const { marketplaceMode } = usePublicSettings();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [list, setList] = useState<WarehouseProduct[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryRoot[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<WarehouseProduct | null>(null);
  const [saving, setSaving] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newStock, setNewStock] = useState('0');
  const [newSku, setNewSku] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [createFromScanner, setCreateFromScanner] = useState(false);
  const [newImageUrls, setNewImageUrls] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [manualSku, setManualSku] = useState('');
  const [manualSkuBusy, setManualSkuBusy] = useState(false);
  const lastTsdSkuRef = useRef<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const createCameraInputRef = useRef<HTMLInputElement>(null);
  const createGalleryInputRef = useRef<HTMLInputElement>(null);
  const newImageUrlsRef = useRef<string[]>([]);
  newImageUrlsRef.current = newImageUrls;

  const subcats = useMemo(() => (categories ? flattenSubcategories(categories) : []), [categories]);

  const MAX_PRODUCT_PHOTOS = 5;

  const uploadWarehouseImage = async (file: File) => {
    if (!token) throw new Error('Kirish talab qilinadi');
    const fd = new FormData();
    fd.append('file', file);
    const r = await apiFetch(`${API_URL}/upload/image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const raw = await r.text();
    const ct = r.headers.get('content-type') ?? '';
    if (!ct.includes('application/json')) {
      throw new Error(
        r.status === 413 || raw.includes('413')
          ? 'Rasm juda katta. Kichikroq fayl yoki kamroq pikselli surat yuklang.'
          : 'Server JSON oʻrniga HTML qaytardi (odatda proksi yoki API manzili notoʻgʻri). NEXT_PUBLIC_API_URL va tarmoqni tekshiring.'
      );
    }
    let data: { url?: string; message?: string };
    try {
      data = raw ? (JSON.parse(raw) as { url?: string; message?: string }) : {};
    } catch {
      throw new Error('Server javobi JSON emas. API ishlayotganini va /upload/image ochiq ekanini tekshiring.');
    }
    if (!r.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Yuklash xatosi');
    if (!data.url) throw new Error('URL yoʻq');
    return data.url;
  };

  const handleCreateImageFiles = async (files: FileList | null, input: HTMLInputElement | null) => {
    if (!files?.length) {
      if (input) input.value = '';
      return;
    }
    const room = MAX_PRODUCT_PHOTOS - newImageUrlsRef.current.length;
    if (room <= 0) {
      toast.message(`Maksimum ${MAX_PRODUCT_PHOTOS} ta rasm`);
      if (input) input.value = '';
      return;
    }
    const list = Array.from(files).slice(0, room);
    setUploadingImage(true);
    try {
      for (const file of list) {
        if (newImageUrlsRef.current.length >= MAX_PRODUCT_PHOTOS) break;
        const url = await uploadWarehouseImage(file);
        setNewImageUrls((prev) => (prev.length >= MAX_PRODUCT_PHOTOS ? prev : [...prev, url]));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Rasm yuklanmadi');
    } finally {
      setUploadingImage(false);
      if (input) input.value = '';
    }
  };

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadList = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const q = debounced ? `&search=${encodeURIComponent(debounced)}` : '';
      const r = await apiFetch(`${API_URL}/products/my?page=1&limit=100${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await r.json()) as { data: WarehouseProduct[] };
      if (!r.ok) throw new Error((data as { message?: string }).message ?? 'Xatolik');
      setList(data.data);
    } catch {
      toast.error('Roʻyxat yuklanmadi');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [token, debounced]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    apiFetch(`${API_URL}/categories`)
      .then((r) => r.json())
      .then((rows: CategoryRoot[]) => setCategories(Array.isArray(rows) ? rows : []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!focusProductId || !token) return;
    let cancelled = false;
    (async () => {
      const r = await apiFetch(`${API_URL}/products/my/${focusProductId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const raw = (await r.json()) as WarehouseProduct & { price?: unknown };
      if (cancelled) return;
      if (!r.ok || !raw?.id) {
        toast.error('Tovar topilmadi');
        onFocusConsumed();
        return;
      }
      const normalized: WarehouseProduct = {
        ...raw,
        price: String(raw.price),
        description: raw.description ?? '',
        images: raw.images ?? [],
        variants: (raw.variants ?? []).map((v) => ({
          ...v,
          priceOverride: v.priceOverride != null ? String(v.priceOverride) : null,
        })),
      };
      setEditing(normalized);
      setEditOpen(true);
      onFocusConsumed();
    })();
    return () => {
      cancelled = true;
    };
  }, [focusProductId, token, onFocusConsumed]);

  useEffect(() => {
    if (!tsdScanSku?.trim()) {
      lastTsdSkuRef.current = null;
      return;
    }
    const sku = tsdScanSku.trim();
    if (sku === lastTsdSkuRef.current) return;
    lastTsdSkuRef.current = sku;
    setNewSku(sku);
    setNewTitle('');
    setNewDescription('');
    setNewPrice('');
    setNewStock('1');
    setNewImageUrls([]);
    setNewCategoryId(subcats[0]?.id ?? '');
    setCreateFromScanner(true);
    setCreateOpen(true);
    onTsdScanSkuConsumed();
  }, [tsdScanSku, subcats, onTsdScanSkuConsumed]);

  useEffect(() => {
    if (createOpen && createFromScanner) {
      const id = requestAnimationFrame(() => titleInputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [createOpen, createFromScanner]);

  useEffect(() => {
    if (!createOpen || !createFromScanner || newCategoryId) return;
    const first = subcats[0]?.id;
    if (first) setNewCategoryId(first);
  }, [createOpen, createFromScanner, newCategoryId, subcats]);

  const submitManualSku = async () => {
    const s = manualSku.trim();
    if (!s) {
      toast.message('SKU yoki kod kiriting');
      return;
    }
    if (!onLookupBySku) return;
    setManualSkuBusy(true);
    try {
      await onLookupBySku(s);
    } finally {
      setManualSkuBusy(false);
    }
  };

  const openCreate = () => {
    setCreateFromScanner(false);
    setNewTitle('');
    setNewDescription('');
    setNewPrice('');
    setNewStock('0');
    setNewSku('');
    setNewImageUrls([]);
    setNewCategoryId(subcats[0]?.id ?? '');
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (!token) return;
    const price = Number(newPrice);
    const stock = Math.max(0, Math.floor(Number(newStock) || 0));
    if (!newTitle.trim()) {
      toast.error('Nom kiriting');
      return;
    }
    if (!newCategoryId) {
      toast.error('Ostkategoriya tanlang');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error('Narx notoʻgʻri');
      return;
    }
    setSaving(true);
    try {
      const r = await apiFetch(`${API_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || 'POS / ombor',
          price,
          stock,
          sku: newSku.trim() || undefined,
          categoryId: newCategoryId,
          imageUrls: newImageUrls.length > 0 ? newImageUrls : undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast.error(typeof data?.message === 'string' ? data.message : 'Yaratilmadi');
        return;
      }
      toast.success('Tovar yaratildi');
      setCreateOpen(false);
      setCreateFromScanner(false);
      setNewImageUrls([]);
      loadList();
      onCatalogChanged();
    } finally {
      setSaving(false);
    }
  };

  const saveSimpleStock = async (p: WarehouseProduct, stock: number) => {
    if (!token) return;
    const n = Math.max(0, Math.floor(stock));
    try {
      const r = await apiFetch(`${API_URL}/products/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stock: n }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast.error(typeof data?.message === 'string' ? data.message : 'Saqlanmadi');
        return;
      }
      toast.success('Ombor yangilandi');
      loadList();
      onCatalogChanged();
    } catch {
      toast.error('Tarmoq xatosi');
    }
  };

  const saveVariantStock = async (productId: string, variantId: string, stock: number) => {
    if (!token) return;
    const n = Math.max(0, Math.floor(stock));
    try {
      const r = await apiFetch(`${API_URL}/products/my/${productId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const full = (await r.json()) as WarehouseProduct & { options?: Record<string, string[]> };
      if (!r.ok) {
        toast.error('Tovar yuklanmadi');
        return;
      }
      const variants = full.variants.map((v) => ({
        options: v.options as Record<string, string>,
        stock: v.id === variantId ? n : v.stock,
        sku: v.sku ?? undefined,
        priceOverride: v.priceOverride != null ? Number(v.priceOverride) : undefined,
      }));
      const r2 = await apiFetch(`${API_URL}/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          variants,
          options: full.options ?? undefined,
        }),
      });
      const data = await r2.json();
      if (!r2.ok) {
        toast.error(typeof data?.message === 'string' ? data.message : 'Saqlanmadi');
        return;
      }
      toast.success('Variant ombori yangilandi');
      loadList();
      onCatalogChanged();
      if (editing?.id === productId) {
        setEditing({ ...full, variants: full.variants.map((v) => (v.id === variantId ? { ...v, stock: n } : v)) });
      }
    } catch {
      toast.error('Tarmoq xatosi');
    }
  };

  const openEdit = (p: WarehouseProduct) => {
    setEditing(p);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!token || !editing) return;
    const price = Number(editing.price);
    if (!editing.title.trim()) {
      toast.error('Nom kiriting');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error('Narx notoʻgʻri');
      return;
    }
    setSaving(true);
    try {
      const r = await apiFetch(`${API_URL}/products/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: editing.title.trim(),
          description: editing.description?.trim() || '—',
          price,
          stock: editing.variants.length === 0 ? Math.max(0, editing.stock) : undefined,
          sku: editing.sku?.trim() || null,
          isActive: editing.isActive,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast.error(typeof data?.message === 'string' ? data.message : 'Saqlanmadi');
        return;
      }
      toast.success('Saqlandi');
      setEditOpen(false);
      setEditing(null);
      loadList();
      onCatalogChanged();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Boxes className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <p className="text-sm">
            <strong className="text-foreground">TSD (terminal yigʻish):</strong> «Kamera skaner»ni oching,{' '}
            <strong>Ombor</strong> rejimida yangi shtrix-kodni skanerlang — SKU avto toʻldiriladi, nom va narxni
            kiriting, saqlang; keyingi kodni skanerlash mumkin (kamera ochiq qoladi).
          </p>
        </div>
        <Button type="button" className="gap-2 shrink-0" onClick={openCreate} disabled={!subcats.length}>
          <PackagePlus className="h-4 w-4" />
          Yangi tovar
        </Button>
      </div>

      <DashboardPanel className="min-w-0 p-3 sm:p-5">
        {onLookupBySku ? (
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="relative min-w-0 flex-1">
              <ScanLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-11 pl-9 font-mono text-sm"
                placeholder="SKU / shtrix-kod (qo‘lda)..."
                value={manualSku}
                onChange={(e) => setManualSku(e.target.value)}
                aria-label="SKU bo‘yicha tekshirish"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submitManualSku();
                }}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              className="h-11 shrink-0 gap-2"
              disabled={manualSkuBusy}
              onClick={() => void submitManualSku()}
            >
              {manualSkuBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
              Kodni tekshirish
            </Button>
          </div>
        ) : null}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9 h-11"
            placeholder="Nom yoki SKU bo‘yicha qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Ombor qidiruv"
          />
        </div>

        {loading ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : !list?.length ? (
          <p className="text-sm text-muted-foreground">Tovar yoʻq yoki qidiruv boʻsh.</p>
        ) : (
          <ul className="flex flex-col gap-2 md:gap-3">
            {list.map((p) => (
              <li
                key={p.id}
                className={cn(
                  'rounded-xl border border-border/80 bg-card/60 p-3 shadow-sm sm:p-4',
                  !p.isActive && 'opacity-75 border-dashed'
                )}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {p.images[0]?.url ? (
                        <Image src={p.images[0].url} alt="" fill className="object-cover" sizes="64px" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">—</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold leading-tight">{p.title}</p>
                        {!p.isActive ? (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">
                            O‘chirilgan
                          </span>
                        ) : null}
                        {!p.isModerated ? (
                          <span className="rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 text-[10px] font-medium">
                            Moderatsiya
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {formatPrice(Number(p.price))}
                        {p.sku ? (
                          <span className="ml-2 font-mono text-xs">SKU: {p.sku}</span>
                        ) : null}
                      </p>
                      {p.category?.name ? (
                        <p className="text-xs text-muted-foreground">{p.category.name}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:flex-col xl:flex-row lg:items-stretch">
                    {p.variants.length === 0 ? (
                      <QuickStockInput
                        initial={p.stock}
                        onSave={(n) => void saveSimpleStock(p, n)}
                      />
                    ) : (
                      <div className="flex flex-col gap-2 rounded-lg border border-border/50 bg-muted/20 p-2 text-sm w-full sm:min-w-[220px]">
                        <p className="text-xs font-medium text-muted-foreground">Variantlar</p>
                        {p.variants.map((v) => (
                          <div key={v.id} className="flex flex-wrap items-end gap-2 border-b border-border/30 pb-2 last:border-0 last:pb-0">
                            <span className="min-w-0 flex-1 text-xs">
                              {variantLabel(v.options) || v.sku || v.id.slice(0, 8)}
                            </span>
                            <QuickStockInput
                              initial={v.stock}
                              narrow
                              onSave={(n) => void saveVariantStock(p.id, v.id, n)}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    <Button type="button" variant="outline" size="sm" className="gap-1 shrink-0" onClick={() => openEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Tahrirlash
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DashboardPanel>

      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) setCreateFromScanner(false);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{createFromScanner ? 'TSD: yangi tovar (skaner)' : 'Yangi tovar'}</DialogTitle>
            <DialogDescription>
              {createFromScanner
                ? 'SKU kamera orqali olingan. Nom, narx va ostkategoriyani kiriting, saqlang — keyin keyingi shtrix-kodni skanerlang.'
                : marketplaceMode === 'SINGLE_SHOP'
                  ? 'Ostkategoriya majburiy. Yakka doʻkon rejimida tovar yaratilgach darhol katalogda chiqadi.'
                  : 'Ostkategoriya majburiy. Koʻp sotuvchi rejimida tovar admin moderatsiyasidan keyin katalogda paydo boʻladi.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label htmlFor="wh-title">Nomi</Label>
              <Input
                ref={titleInputRef}
                id="wh-title"
                className="mt-1"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="wh-desc">Tavsif</Label>
              <textarea
                id="wh-desc"
                className="mt-1 w-full min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Qisqa tavsif (ixtiyoriy)"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="wh-price">Narx</Label>
                <Input id="wh-price" className="mt-1" type="number" min={0} value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="wh-stock">Ombor</Label>
                <Input id="wh-stock" className="mt-1" type="number" min={0} value={newStock} onChange={(e) => setNewStock(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="wh-sku">SKU / shtrix-kod</Label>
              <Input
                id="wh-sku"
                className={cn('mt-1 font-mono text-sm', createFromScanner && 'bg-primary/5 ring-1 ring-primary/20')}
                value={newSku}
                onChange={(e) => setNewSku(e.target.value)}
                placeholder="ixtiyoriy"
              />
              {createFromScanner ? (
                <p className="mt-1 text-xs text-muted-foreground">Kamera skaneridan avto toʻldirildi; xato boʻlsa qoʻlda tuzating.</p>
              ) : null}
            </div>
            <div>
              <Label>Rasmlar</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Kamera yoki galereya (maks. {MAX_PRODUCT_PHOTOS} ta). Telefonda «Suratga olish» orqa kamerani ochadi.
              </p>
              <input
                ref={createCameraInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="sr-only"
                aria-hidden
                onChange={(e) => void handleCreateImageFiles(e.target.files, e.target)}
              />
              <input
                ref={createGalleryInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                aria-hidden
                onChange={(e) => void handleCreateImageFiles(e.target.files, e.target)}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                  disabled={uploadingImage || newImageUrls.length >= MAX_PRODUCT_PHOTOS}
                  onClick={() => createCameraInputRef.current?.click()}
                >
                  {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  Suratga olish
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={uploadingImage || newImageUrls.length >= MAX_PRODUCT_PHOTOS}
                  onClick={() => createGalleryInputRef.current?.click()}
                >
                  <ImagePlus className="h-4 w-4" />
                  Galereya
                </Button>
              </div>
              {newImageUrls.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {newImageUrls.map((url) => (
                    <li key={url} className="relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element -- tashqi / lokal yuklash URL */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 text-destructive shadow-sm ring-1 ring-border hover:bg-destructive/10"
                        aria-label="Rasmni olib tashlash"
                        onClick={() => setNewImageUrls((prev) => prev.filter((u) => u !== url))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div>
              <Label>Ostkategoriya</Label>
              <Select value={newCategoryId} onValueChange={setNewCategoryId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Tanlang" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {subcats.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Bekor
            </Button>
            <Button type="button" disabled={saving || uploadingImage} onClick={() => void submitCreate()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Yaratish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(o) => !o && (setEditOpen(false), setEditing(null))}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tovarni tahrirlash</DialogTitle>
            <DialogDescription>Asosiy maydonlar. Variant omborini roʻyxatdan oʻzgartiring.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <>
              <div className="grid gap-3 py-2">
                <div>
                  <Label>Nomi</Label>
                  <Input className="mt-1" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                </div>
                <div>
                  <Label>Tavsif</Label>
                  <textarea
                    className="mt-1 w-full min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editing.description}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Narx</Label>
                    <Input
                      className="mt-1"
                      type="number"
                      min={0}
                      value={editing.price}
                      onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                    />
                  </div>
                  {editing.variants.length === 0 ? (
                    <div>
                      <Label>Ombor</Label>
                      <Input
                        className="mt-1"
                        type="number"
                        min={0}
                        value={editing.stock}
                        onChange={(e) => setEditing({ ...editing, stock: Math.max(0, Number(e.target.value) || 0) })}
                      />
                    </div>
                  ) : null}
                </div>
                <div>
                  <Label>SKU</Label>
                  <Input
                    className="mt-1 font-mono text-sm"
                    value={editing.sku ?? ''}
                    onChange={(e) => setEditing({ ...editing, sku: e.target.value || null })}
                  />
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={editing.isActive}
                    onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                  />
                  Katalogda faol
                </label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => (setEditOpen(false), setEditing(null))}>
                  Yopish
                </Button>
                <Button type="button" disabled={saving} onClick={() => void saveEdit()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Saqlash'}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuickStockInput({
  initial,
  onSave,
  narrow,
}: {
  initial: number;
  onSave: (n: number) => void;
  narrow?: boolean;
}) {
  const [v, setV] = useState(String(initial));
  useEffect(() => {
    setV(String(initial));
  }, [initial]);
  return (
    <div className={cn('flex items-end gap-2', narrow ? 'flex-1 min-w-[120px]' : 'w-full sm:w-auto')}>
      <div className={cn('min-w-0', narrow ? 'flex-1' : 'w-24')}>
        <Label className="text-xs text-muted-foreground">Ombor</Label>
        <Input
          className="mt-1 h-9 font-mono tabular-nums"
          type="number"
          min={0}
          value={v}
          onChange={(e) => setV(e.target.value)}
        />
      </div>
      <Button type="button" size="sm" className="h-9 shrink-0" variant="secondary" onClick={() => onSave(Math.max(0, Math.floor(Number(v) || 0)))}>
        OK
      </Button>
    </div>
  );
}
