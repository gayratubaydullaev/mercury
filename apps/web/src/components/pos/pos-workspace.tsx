'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ScanLine,
  Loader2,
  Camera,
  Store,
  Warehouse,
  Banknote,
  RotateCcw,
  Keyboard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { API_URL, formatPrice, cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';
import { DashboardPanel } from '@/components/dashboard/dashboard-panel';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PosBarcodeScanner } from '@/components/pos/pos-barcode-scanner';
import { PosReceipt, type PosReceiptOrder } from '@/components/pos/pos-receipt';
import { PosWarehouseSection } from '@/components/pos/pos-warehouse-section';
import { playPosScanBeep } from '@/lib/pos-audio';

type ProductVariant = {
  id: string;
  options: unknown;
  stock: number;
  sku?: string | null;
  priceOverride: string | null;
};

type CatalogProduct = {
  id: string;
  title: string;
  price: string;
  stock: number;
  isActive: boolean;
  images: { url: string }[];
  variants: ProductVariant[];
};

type CartLine = {
  key: string;
  productId: string;
  variantId?: string;
  title: string;
  variantLabel?: string;
  quantity: number;
  unitPrice: number;
  imageUrl?: string;
};

type PosMode = 'kassa' | 'ombor';

type LastScanBanner = {
  code: string;
  tone: 'ok' | 'warn' | 'err';
  text: string;
};

function variantLabel(options: unknown): string {
  if (options && typeof options === 'object' && !Array.isArray(options)) {
    return Object.entries(options as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(', ');
  }
  return options != null ? String(options) : '';
}

function unitPriceFor(product: CatalogProduct, variantId?: string): number {
  if (variantId) {
    const v = product.variants.find((x) => x.id === variantId);
    if (v?.priceOverride != null) return Number(v.priceOverride);
  }
  return Number(product.price);
}

function stockFor(product: CatalogProduct, variantId?: string): number {
  if (variantId) {
    return product.variants.find((x) => x.id === variantId)?.stock ?? 0;
  }
  return product.stock;
}

export type PosWorkspaceProps = {
  ordersBasePath: string;
  eyebrow: string;
  title: string;
  description: string;
  /** Kassir: faqat kassa, ombor rejimi yashirin */
  cashierOnly?: boolean;
};

export function PosWorkspace({
  ordersBasePath,
  eyebrow,
  title,
  description,
  cashierOnly = false,
}: PosWorkspaceProps) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const [posMode, setPosMode] = useState<PosMode>('kassa');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [catalog, setCatalog] = useState<CatalogProduct[] | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [variantPick, setVariantPick] = useState<Record<string, string>>({});
  const [guestPhone, setGuestPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD_ON_DELIVERY'>('CASH');
  const [markPaid, setMarkPaid] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<PosReceiptOrder | null>(null);
  const [warehouseFocusId, setWarehouseFocusId] = useState<string | null>(null);
  const [tsdQuickAddSku, setTsdQuickAddSku] = useState<string | null>(null);
  const [lastScanBanner, setLastScanBanner] = useState<LastScanBanner | null>(null);
  const [cashReceived, setCashReceived] = useState('');
  const [usbScanDraft, setUsbScanDraft] = useState('');

  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const usbScanInputRef = useRef<HTMLInputElement>(null);
  const processBarcodeRef = useRef<(text: string, mode: PosMode) => Promise<boolean>>(async () => false);
  const submitPosRef = useRef<() => Promise<void>>(async () => {});
  const clearWarehouseFocus = useCallback(() => setWarehouseFocusId(null), []);
  const clearTsdQuickAddSku = useCallback(() => setTsdQuickAddSku(null), []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadCatalog = useCallback(async () => {
    if (!token) return;
    setLoadingCatalog(true);
    try {
      const q = debounced ? `&search=${encodeURIComponent(debounced)}` : '';
      const r = await apiFetch(`${API_URL}/products/my?page=1&limit=80${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await r.json()) as { data: CatalogProduct[] };
      if (!r.ok) throw new Error((data as { message?: string }).message ?? 'Xatolik');
      setCatalog(data.data.filter((p) => p.isActive));
    } catch {
      toast.error('Tovarlar yuklanmadi');
      setCatalog([]);
    } finally {
      setLoadingCatalog(false);
    }
  }, [token, debounced]);

  useEffect(() => {
    if (posMode === 'kassa') loadCatalog();
  }, [loadCatalog, posMode]);

  useEffect(() => {
    if (cashierOnly) setPosMode('kassa');
  }, [cashierOnly]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        const el = document.activeElement as HTMLElement | null;
        const tag = el?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
        e.preventDefault();
        setScannerOpen(true);
        return;
      }
      if (e.key === 'F3' && posMode === 'kassa') {
        e.preventDefault();
        usbScanInputRef.current?.focus();
        usbScanInputRef.current?.select();
        return;
      }
      if (e.key === 'F9') {
        if (scannerOpen || receiptOrder) return;
        if (posMode !== 'kassa') return;
        const el = document.activeElement as HTMLElement | null;
        const tag = el?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
        e.preventDefault();
        void submitPosRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [posMode, scannerOpen, receiptOrder]);

  /** USB skaner: fokus boshqa maydonda bo‘lganda Enter bilan yakunlanadi */
  useEffect(() => {
    if (posMode !== 'kassa') return;
    let buf = '';
    let timer: ReturnType<typeof setTimeout> | null = null;
    const resetBuf = () => {
      buf = '';
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') {
        const v = buf.trim();
        resetBuf();
        if (v.length >= 2) {
          e.preventDefault();
          void processBarcodeRef.current(v, 'kassa');
        }
        return;
      }
      if (e.key === 'Escape') {
        resetBuf();
        return;
      }
      if (e.key.length === 1) {
        buf += e.key;
        if (timer !== null) clearTimeout(timer);
        timer = setTimeout(() => {
          buf = '';
          timer = null;
        }, 2500);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      resetBuf();
    };
  }, [posMode]);

  const cartTotal = useMemo(
    () => cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
    [cart]
  );
  const cartTotalRounded = Math.round(cartTotal);
  const cashReceivedNum = useMemo(() => {
    const s = cashReceived.replace(/\s/g, '').replace(/,/g, '.');
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n) : 0;
  }, [cashReceived]);
  const cashShort =
    paymentMethod === 'CASH' &&
    markPaid &&
    cashReceived.trim() !== '' &&
    cashReceivedNum < cartTotalRounded;
  const changeDue =
    paymentMethod === 'CASH' && markPaid && cashReceived.trim() !== ''
      ? Math.max(0, cashReceivedNum - cartTotalRounded)
      : 0;

  const addLine = useCallback((product: CatalogProduct, opts?: { variantId?: string }) => {
    const hasV = product.variants.length > 0;
    const vid = opts?.variantId ?? (hasV ? variantPick[product.id] : undefined);
    if (hasV && !vid) {
      toast.message('Avval variantni tanlang');
      return false;
    }
    const avail = stockFor(product, vid);
    if (avail < 1) {
      toast.error('Omborda yoʻq');
      return false;
    }
    const key = `${product.id}:${vid ?? ''}`;
    const price = unitPriceFor(product, vid);
    const vLabel = vid ? variantLabel(product.variants.find((x) => x.id === vid)?.options) : undefined;
    setCart((prev) => {
      const i = prev.findIndex((l) => l.key === key);
      if (i >= 0) {
        const next = [...prev];
        const cur = next[i]!;
        if (cur.quantity >= avail) {
          toast.message(`Maksimum ${avail} ta`);
          return prev;
        }
        next[i] = { ...cur, quantity: cur.quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          key,
          productId: product.id,
          variantId: vid,
          title: product.title,
          variantLabel: vLabel,
          quantity: 1,
          unitPrice: price,
          imageUrl: product.images[0]?.url,
        },
      ];
    });
    return true;
  }, [variantPick]);

  const processBarcodeText = useCallback(
    async (text: string, mode: PosMode): Promise<boolean> => {
      if (!token) return false;
      const now = Date.now();
      if (lastScanRef.current.code === text && now - lastScanRef.current.at < 750) return false;
      lastScanRef.current = { code: text, at: now };

      const r = await apiFetch(`${API_URL}/products/my/by-sku/${encodeURIComponent(text)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await r.json()) as {
        found?: boolean;
        match?: string;
        variantId?: string;
        product?: CatalogProduct;
        message?: string;
      };
      const displayCode = text.trim();
      if (!r.ok) {
        const msg = typeof data?.message === 'string' ? data.message : 'Soʻrov xatosi';
        toast.error(msg);
        setLastScanBanner({ code: displayCode || '—', tone: 'err', text: msg });
        return false;
      }
      if (!data.found) {
        if (mode === 'ombor') {
          const raw = text.trim();
          if (!raw) return false;
          playPosScanBeep();
          setTsdQuickAddSku(raw);
          setLastScanBanner({
            code: raw,
            tone: 'warn',
            text: 'Bazada yoʻq — yangi tovar formasi',
          });
          toast.message('Yangi shtrix-kod — forma ochildi (TSD). Nom va narxni kiriting.');
          return true;
        }
        toast.error('SKU topilmadi');
        setLastScanBanner({ code: displayCode, tone: 'err', text: 'Topilmadi' });
        return false;
      }
      const p = data.product;
      if (!p) {
        toast.error('Javob notoʻgʻri');
        setLastScanBanner({ code: displayCode, tone: 'err', text: 'Javob xato' });
        return false;
      }

      if (mode === 'ombor') {
        playPosScanBeep();
        setWarehouseFocusId(p.id);
        setLastScanBanner({ code: displayCode, tone: 'ok', text: 'Tovar topildi — tahrir oynasi' });
        return true;
      }

      if (data.match === 'variant' && data.variantId) {
        setVariantPick((s) => ({ ...s, [p.id]: data.variantId! }));
        const ok = addLine(p, { variantId: data.variantId });
        if (ok) {
          playPosScanBeep();
          setLastScanBanner({ code: displayCode, tone: 'ok', text: 'Savatga qoʻshildi (variant)' });
        } else {
          setLastScanBanner({ code: displayCode, tone: 'warn', text: 'Qoʻshilmadi (variant yoki limit)' });
        }
        return ok;
      }
      const ok = addLine(p);
      if (ok) {
        playPosScanBeep();
        setLastScanBanner({ code: displayCode, tone: 'ok', text: 'Savatga qoʻshildi' });
      } else {
        setLastScanBanner({ code: displayCode, tone: 'warn', text: 'Qoʻshilmadi (limit yoki variant)' });
      }
      return ok;
    },
    [token, addLine]
  );

  processBarcodeRef.current = processBarcodeText;

  const setQty = (key: string, qty: number) => {
    setCart((prev) => {
      const line = prev.find((l) => l.key === key);
      if (!line) return prev;
      const product = catalog?.find((p) => p.id === line.productId);
      if (!product) return prev;
      const max = stockFor(product, line.variantId);
      const nextQty = Math.max(1, Math.min(qty, max));
      return prev.map((l) => (l.key === key ? { ...l, quantity: nextQty } : l));
    });
  };

  const removeLine = (key: string) => setCart((prev) => prev.filter((l) => l.key !== key));

  if (!token) {
    return <DashboardAuthGate />;
  }

  const submitPos = async () => {
    if (!token || cart.length === 0 || cashShort) return;
    setSubmitting(true);
    setLastOrderId(null);
    try {
      const r = await apiFetch(`${API_URL}/orders/pos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: cart.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            quantity: l.quantity,
          })),
          paymentMethod,
          markPaid,
          guestPhone: guestPhone.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        const m = data?.message;
        let msg = 'Buyurtma yaratilmadi';
        if (typeof m === 'string') msg = m;
        else if (m && typeof m === 'object' && 'message' in m && typeof (m as { message: string }).message === 'string') {
          msg = (m as { message: string }).message;
        } else if (m && typeof m === 'object' && Array.isArray((m as { outOfStock?: string[] }).outOfStock)) {
          msg = (m as { outOfStock: string[] }).outOfStock.join('; ');
        }
        toast.error(msg);
        return;
      }
      toast.success(`Buyurtma: ${data.orderNumber ?? data.id}`);
      setLastOrderId(data.id as string);
      setReceiptOrder(data as PosReceiptOrder);
      setCart([]);
      setNotes('');
      setCashReceived('');
      loadCatalog();
    } finally {
      setSubmitting(false);
    }
  };

  submitPosRef.current = submitPos;

  const modeDescription =
    posMode === 'kassa'
      ? 'Kassa: savat, toʻlov, chek. Kamera — ketma-ket skanerlash, ovozli tasdiq.'
      : 'Ombor / TSD: mavjud kod — tahrirlash oynasi; yangi kod — yangi tovar formasi (SKU avto). Kamera yopilmasdan ketma-ket skanerlash mumkin.';

  return (
    <>
      <DashboardPageHeader eyebrow={eyebrow} title={title} description={description} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {cashierOnly ? (
          <div
            className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-2.5 text-sm font-medium text-foreground"
            role="status"
          >
            <Store className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            Kassa rejimi
            <span className="hidden text-xs font-normal text-muted-foreground sm:inline">· F2 kamera · F3 kod · F9 toʻlash</span>
          </div>
        ) : (
          <div
            className="inline-flex w-full max-w-md rounded-xl border border-border/80 bg-muted/40 p-1 shadow-inner sm:w-auto"
            role="tablist"
            aria-label="POS rejimi"
          >
            <button
              type="button"
              role="tab"
              aria-selected={posMode === 'kassa'}
              onClick={() => setPosMode('kassa')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]',
                posMode === 'kassa'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Store className="h-4 w-4 shrink-0" aria-hidden />
              Kassa
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={posMode === 'ombor'}
              onClick={() => setPosMode('ombor')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]',
                posMode === 'ombor'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Warehouse className="h-4 w-4 shrink-0" aria-hidden />
              Ombor
            </button>
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full gap-2 sm:w-auto shrink-0 border-primary/30 bg-primary/5"
          onClick={() => setScannerOpen(true)}
        >
          <Camera className="h-4 w-4" />
          Kamera (F2)
        </Button>
      </div>
      <p
        className={cn(
          'text-sm text-muted-foreground',
          posMode === 'kassa' ? (lastScanBanner ? 'mb-2' : 'mb-3') : lastScanBanner ? 'mb-2' : 'mb-6'
        )}
      >
        {modeDescription}
      </p>
      {posMode === 'kassa' ? (
        <div
          className={cn('flex flex-wrap gap-2', lastScanBanner ? 'mb-2' : 'mb-6')}
          aria-label="Tezkor tugmalar"
        >
          {(
            [
              { k: 'F2', t: 'Kamera skaner' },
              { k: 'F3', t: 'USB maydon' },
              { k: 'F9', t: 'Toʻlash (savat tayyor)' },
            ] as const
          ).map(({ k, t }) => (
            <span
              key={k}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground"
            >
              <kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-[0.7rem] font-semibold text-foreground shadow-sm">
                {k}
              </kbd>
              {t}
            </span>
          ))}
        </div>
      ) : null}
      {lastScanBanner ? (
        <p
          className={cn(
            'mb-6 text-xs sm:text-sm',
            lastScanBanner.tone === 'ok' && 'text-emerald-700 dark:text-emerald-400',
            lastScanBanner.tone === 'warn' && 'text-amber-800 dark:text-amber-400',
            lastScanBanner.tone === 'err' && 'text-destructive'
          )}
        >
          <span className="font-medium">{lastScanBanner.text}</span>
          {lastScanBanner.code ? (
            <>
              {' '}
              · <span className="font-mono">{lastScanBanner.code}</span>
            </>
          ) : null}
        </p>
      ) : null}

      {posMode === 'ombor' && !cashierOnly && token ? (
        <PosWarehouseSection
          token={token}
          onCatalogChanged={loadCatalog}
          focusProductId={warehouseFocusId}
          onFocusConsumed={clearWarehouseFocus}
          tsdScanSku={tsdQuickAddSku}
          onTsdScanSkuConsumed={clearTsdQuickAddSku}
          onLookupBySku={(sku) => {
            void processBarcodeText(sku, 'ombor');
          }}
        />
      ) : null}

      {posMode === 'kassa' ? (
        <div
          className={cn(
            'grid gap-4 pb-24 md:pb-6 lg:gap-6',
            'xl:grid-cols-[minmax(0,1fr)_minmax(300px,400px)]',
            cart.length > 0 && 'max-md:pb-28'
          )}
        >
          <DashboardPanel className="min-w-0 overflow-hidden p-3 sm:p-5 md:p-6">
            <div className="mb-4 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-3 sm:p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Keyboard className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                <span className="font-medium text-foreground">USB shtrix-skanner</span>
                <span className="hidden sm:inline">F3 — fokus · boshqa joyda kod + Enter</span>
              </div>
              <Input
                ref={usbScanInputRef}
                className="h-11 font-mono text-base"
                placeholder="Skaner kodni shu yerga yozadi…"
                value={usbScanDraft}
                onChange={(e) => setUsbScanDraft(e.target.value)}
                aria-label="USB shtrix-kod maydoni"
                autoComplete="off"
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const v = usbScanDraft.trim();
                    setUsbScanDraft('');
                    if (v) void processBarcodeText(v, 'kassa');
                  }
                }}
              />
            </div>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 pl-9"
                  placeholder="Tovar qidirish..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Tovar qidirish"
                />
              </div>
            </div>
            {loadingCatalog ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            ) : !catalog?.length ? (
              <p className="text-sm text-muted-foreground">Faol tovar yoʻq yoki natija topilmadi.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {catalog.map((p) => {
                  const hasV = p.variants.length > 0;
                  const vid = variantPick[p.id];
                  const canAdd = !hasV || Boolean(vid);
                  return (
                    <li
                      key={p.id}
                      className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/80 p-3 shadow-sm sm:flex-row sm:items-center sm:p-4"
                    >
                      <div className="flex min-w-0 flex-1 gap-3">
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-[72px] sm:w-[72px]">
                          {p.images[0]?.url ? (
                            <Image src={p.images[0].url} alt="" fill className="object-cover" sizes="72px" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                              —
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium leading-snug">{p.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatPrice(unitPriceFor(p, hasV ? vid : undefined))} · ombor:{' '}
                            {stockFor(p, hasV ? vid : undefined)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:shrink-0 sm:items-end">
                        {hasV ? (
                          <Select
                            value={vid}
                            onValueChange={(v) => setVariantPick((s) => ({ ...s, [p.id]: v }))}
                          >
                            <SelectTrigger className="h-11 w-full min-w-[200px] sm:w-[220px]">
                              <SelectValue placeholder="Variant" />
                            </SelectTrigger>
                            <SelectContent>
                              {p.variants.map((v) => (
                                <SelectItem key={v.id} value={v.id} disabled={v.stock < 1}>
                                  {variantLabel(v.options) || v.sku || v.id.slice(0, 8)} ({v.stock})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : null}
                        <Button
                          type="button"
                          size="lg"
                          className="h-11 w-full min-w-[140px] touch-manipulation sm:w-auto"
                          disabled={!canAdd || stockFor(p, hasV ? vid : undefined) < 1}
                          onClick={() => addLine(p)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Savatga
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </DashboardPanel>

          <aside className="flex flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
            <Card className="border-border/80 shadow-lg ring-1 ring-border/40">
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-3">
                <CardTitle className="flex flex-col gap-0.5 text-lg sm:flex-row sm:items-baseline sm:gap-2">
                  <span className="flex items-center gap-2">
                    <ScanLine className="h-5 w-5 text-primary" aria-hidden />
                    Savat
                  </span>
                  {cart.length > 0 ? (
                    <span className="text-sm font-normal tabular-nums text-muted-foreground">
                      {cart.length} pozitsiya
                    </span>
                  ) : null}
                </CardTitle>
                {cart.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 shrink-0 gap-1 text-destructive hover:text-destructive"
                    onClick={() => {
                      if (typeof window !== 'undefined' && window.confirm('Savatni butunlay tozalaysizmi?')) {
                        setCart([]);
                        setVariantPick({});
                      }
                    }}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Tozalash
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-4">
                {cart.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Savat boʻsh. Tovar tanlang yoki skanerlang.</p>
                ) : (
                  <ul className="max-h-[min(45vh,280px)] space-y-2 overflow-y-auto pr-1 md:max-h-[min(55vh,360px)]">
                    {cart.map((line) => (
                      <li
                        key={line.key}
                        className="flex gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium leading-tight">{line.title}</p>
                          {line.variantLabel ? (
                            <p className="text-xs text-muted-foreground">{line.variantLabel}</p>
                          ) : null}
                          <p className="mt-1 text-muted-foreground">
                            {formatPrice(line.unitPrice)} × {line.quantity}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-10 w-10 touch-manipulation"
                              onClick={() => setQty(line.key, line.quantity - 1)}
                              aria-label="Kamaytirish"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-8 text-center tabular-nums text-base font-medium">{line.quantity}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-10 w-10 touch-manipulation"
                              onClick={() => setQty(line.key, line.quantity + 1)}
                              aria-label="Oshirish"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive"
                            onClick={() => removeLine(line.key)}
                            aria-label="Oʻchirish"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="border-t border-border/60 pt-4">
                  <p className="flex items-end justify-between gap-3 tabular-nums">
                    <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Jami</span>
                    <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                      {formatPrice(cartTotal)}
                    </span>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pos-pay">Toʻlov</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(v) => setPaymentMethod(v as 'CASH' | 'CARD_ON_DELIVERY')}
                  >
                    <SelectTrigger id="pos-pay" className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Naqd</SelectItem>
                      <SelectItem value="CARD_ON_DELIVERY">Karta (terminal)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={markPaid}
                    onChange={(e) => setMarkPaid(e.target.checked)}
                  />
                  Toʻlov darhol qabul qilindi
                </label>

                {paymentMethod === 'CASH' && markPaid ? (
                  <div className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 dark:bg-amber-500/10">
                    <Label htmlFor="pos-cash-in" className="flex items-center gap-2 text-sm font-medium">
                      <Banknote className="h-4 w-4 text-amber-700 dark:text-amber-400" aria-hidden />
                      Naqd olindi
                    </Label>
                    <Input
                      id="pos-cash-in"
                      className="h-11 font-mono text-base tabular-nums"
                      inputMode="decimal"
                      placeholder="Bo‘sh — toʻliq summa deb hisoblanadi"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      aria-describedby="pos-cash-hint"
                    />
                    <p id="pos-cash-hint" className="text-xs text-muted-foreground">
                      Qaytimni tekshirish: olindi summasini kiriting yoki tezkor tugmalar.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-9"
                        onClick={() => setCashReceived(String(cartTotalRounded))}
                      >
                        Aniq jami
                      </Button>
                      {[50_000, 100_000, 200_000, 500_000].map((n) => (
                        <Button
                          key={n}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 font-mono tabular-nums"
                          onClick={() => setCashReceived(String(n))}
                        >
                          {formatPrice(n)}
                        </Button>
                      ))}
                    </div>
                    {cashShort ? (
                      <p className="text-sm font-medium text-destructive">
                        Yetarli emas · kamida {formatPrice(cartTotalRounded - cashReceivedNum)} yetishmayapti
                      </p>
                    ) : null}
                    {!cashShort && changeDue > 0 ? (
                      <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                        Qaytim: {formatPrice(changeDue)}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="pos-phone">Mijoz telefoni</Label>
                  <Input
                    id="pos-phone"
                    className="h-11"
                    placeholder="+998..."
                    inputMode="tel"
                    autoComplete="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pos-notes">Izoh</Label>
                  <Input
                    id="pos-notes"
                    className="h-11"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Chek / eslatma"
                  />
                </div>

                <Button
                  type="button"
                  className="hidden h-12 w-full text-base font-semibold md:inline-flex"
                  size="lg"
                  disabled={cart.length === 0 || submitting || cashShort}
                  onClick={() => void submitPos()}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Yuborilmoqda...
                    </>
                  ) : (
                    'Buyurtmani rasmiylashtirish'
                  )}
                </Button>
                <p className="hidden text-center text-[11px] text-muted-foreground md:block">
                  F9 — tezkor toʻlash (maydon tashqarida)
                </p>

                {lastOrderId ? (
                  <p className="text-center text-sm text-muted-foreground">
                    <Link
                      href={`${ordersBasePath}/${lastOrderId}`}
                      className={cn('font-medium text-primary underline-offset-4 hover:underline')}
                    >
                      Buyurtmani ochish
                    </Link>
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </aside>
        </div>
      ) : null}

      {posMode === 'kassa' && cart.length > 0 ? (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur-md md:hidden"
        >
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Jami</p>
              <p className="text-lg font-bold tabular-nums">{formatPrice(cartTotal)}</p>
            </div>
            <Button
              type="button"
              size="lg"
              className="min-h-[48px] flex-1 max-w-[220px] font-semibold"
              disabled={cart.length === 0 || submitting || cashShort}
              onClick={() => void submitPos()}
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Toʻlash'}
            </Button>
          </div>
        </div>
      ) : null}

      <PosBarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        continuous
        onDecoded={(text) => void processBarcodeText(text, posMode)}
      />

      <Dialog open={!!receiptOrder} onOpenChange={(o) => !o && setReceiptOrder(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chek / elektron nusxa</DialogTitle>
            <DialogDescription className="sr-only">
              Buyurtma cheki, chop etish va nusxalash
            </DialogDescription>
          </DialogHeader>
          {receiptOrder ? <PosReceipt order={receiptOrder} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
