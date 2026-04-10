'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { API_URL, formatPrice, cn } from '@/lib/utils';
import { apiFetch, getCsrfToken } from '@/lib/api';
import { toast } from 'sonner';
import {
  FileSpreadsheet,
  Download,
  Upload,
  Copy,
  CheckCircle,
  XCircle,
  Package,
  Search,
  Pencil,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
} from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardPanel } from '@/components/dashboard/dashboard-panel';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';

/** Bir nechta ustunlar uchun 2,3,4,5,6 ga mos qatorlar (keng ekranda toʻliqroq toʻldirish) */
const PAGE_SIZE = 24;

interface Product {
  id: string;
  title: string;
  slug: string;
  price: string;
  comparePrice?: string | null;
  stock: number;
  sku?: string | null;
  isActive: boolean;
  isModerated: boolean;
  images: { url: string }[];
  category?: { id: string; name: string; slug: string };
  updatedAt?: string;
}

interface ProductsResponse {
  data: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ImportResult {
  created: number;
  failed: number;
  createdTitles?: string[];
  errors: { row: number; title?: string; message: string }[];
}

function stockBadgeClass(stock: number): string {
  if (stock <= 0) return '';
  if (stock < 5) {
    return 'border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100';
  }
  return '';
}

function stockVariant(stock: number): 'destructive' | 'outline' {
  if (stock <= 0) return 'destructive';
  return 'outline';
}

export default function SellerProductsPage() {
  const [data, setData] = useState<ProductsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [copiedErrors, setCopiedErrors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const loadProducts = useCallback(() => {
    if (!token) return;
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (debouncedSearch) params.set('search', debouncedSearch);
    apiFetch(`${API_URL}/products/my?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((raw: ProductsResponse) => {
        setData({
          data: Array.isArray(raw?.data) ? raw.data : [],
          total: Number(raw?.total) || 0,
          page: Number(raw?.page) || page,
          limit: Number(raw?.limit) || PAGE_SIZE,
          totalPages: Number(raw?.totalPages) || 0,
        });
      })
      .catch(() =>
        setData({ data: [], total: 0, page: 1, limit: PAGE_SIZE, totalPages: 0 }),
      );
  }, [token, page, debouncedSearch]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const downloadTemplate = async () => {
    if (!token) return;
    setTemplateLoading(true);
    try {
      const csrf = await getCsrfToken();
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (csrf) headers['x-csrf-token'] = csrf;
      const r = await fetch(`${API_URL}/products/import-template`, { headers, credentials: 'include' });
      if (!r.ok) throw new Error('Yuklab olish amalga oshmadi');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tovarlar-shabloni.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Shablon yuklab olindi');
    } catch {
      toast.error('Shablon yuklab olishda xatolik');
    } finally {
      setTemplateLoading(false);
    }
  };

  const copyErrorsToClipboard = () => {
    if (!importResult?.errors?.length) return;
    const text = importResult.errors
      .map((e) => `Qator ${e.row}${e.title ? ` (${e.title})` : ''}: ${e.message}`)
      .join('\n');
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedErrors(true);
      toast.success('Xatolar nusxalandi');
      setTimeout(() => setCopiedErrors(false), 2000);
    });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      toast.error('Faqat .xlsx yoki .xls fayllar qabul qilinadi');
      e.target.value = '';
      return;
    }
    setImporting(true);
    setImportResult(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const csrf = await getCsrfToken();
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (csrf) headers['x-csrf-token'] = csrf;
      const r = await fetch(`${API_URL}/products/import`, {
        method: 'POST',
        headers,
        body: form,
        credentials: 'include',
      });
      const result = await r.json().catch(() => ({}));
      if (result.created != null) {
        setImportResult(result);
        if (result.created > 0) loadProducts();
        if (result.created > 0 && result.failed === 0) {
          toast.success(`${result.created} ta tovar muvaffaqiyatli qoʻshildi`);
        }
      } else if (!r.ok) {
        const msg = result?.message ?? 'Import amalga oshmadi';
        setImportResult({ created: 0, failed: 1, errors: [{ row: 0, message: msg }] });
        toast.error(msg);
      } else {
        toast.error(result?.message ?? 'Import amalga oshmadi');
      }
    } catch {
      toast.error('Fayl yuklashda xatolik');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  if (!token) return <DashboardAuthGate />;
  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 w-full max-w-md rounded-lg" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[2200px]:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[280px] w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const products = data.data ?? [];
  const total = data.total;
  const totalPages = Math.max(1, data.totalPages || 1);
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="w-full min-w-0 max-w-full space-y-6">
      <DashboardPageHeader
        eyebrow="Sotuvchi kabineti"
        title="Tovarlar"
        description="Roʻyxat, qidiruv, sahifalash va Excel import — barchasi bir joyda."
      >
        <Button asChild className="min-h-[40px] touch-manipulation">
          <Link href="/seller/products/new">+ Yangi tovar</Link>
        </Button>
      </DashboardPageHeader>

      <DashboardPanel>
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FileSpreadsheet className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              Excel orqali toʻplam yuklash
            </CardTitle>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Shablonni yuklab oling, toʻldiring va faylni yuklang. «Kategoriyalar» varaqida kategoriya sluglari berilgan.
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 sm:gap-3 pt-0">
            <Button
              type="button"
              variant="outline"
              className="min-h-[40px] touch-manipulation"
              onClick={downloadTemplate}
              disabled={templateLoading}
            >
              <Download className="h-4 w-4 mr-2 shrink-0" />
              {templateLoading ? 'Yuklanmoqda...' : 'Shablonni yuklab olish'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImport}
              disabled={importing}
            />
            <Button
              type="button"
              variant="secondary"
              className="min-h-[40px] touch-manipulation"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2 shrink-0" />
              {importing ? 'Yuklanmoqda...' : 'Excel faylni yuklash'}
            </Button>
          </CardContent>
        </Card>
      </DashboardPanel>

      <Dialog open={!!importResult} onOpenChange={(open) => !open && setImportResult(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Import natijasi</DialogTitle>
          </DialogHeader>
          {importResult && (
            <div className="space-y-4 overflow-y-auto pr-2">
              <div className="flex gap-4 text-sm flex-wrap">
                {importResult.created > 0 && (
                  <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    {importResult.created} ta qoʻshildi
                  </span>
                )}
                {importResult.failed > 0 && (
                  <span className="flex items-center gap-1.5 text-destructive">
                    <XCircle className="h-4 w-4 shrink-0" />
                    {importResult.failed} ta xato
                  </span>
                )}
              </div>
              {importResult.createdTitles?.length ? (
                <div>
                  <p className="text-muted-foreground text-xs font-medium mb-1">Qoʻshilgan tovarlar:</p>
                  <ul className="text-sm list-disc list-inside max-h-24 overflow-y-auto space-y-0.5">
                    {importResult.createdTitles.slice(0, 20).map((t, i) => (
                      <li key={i} className="truncate">
                        {t}
                      </li>
                    ))}
                    {importResult.createdTitles.length > 20 && (
                      <li className="text-muted-foreground list-none">... va yana {importResult.createdTitles.length - 20} ta</li>
                    )}
                  </ul>
                </div>
              ) : null}
              {importResult.errors?.length ? (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-muted-foreground text-xs font-medium">Xatolar:</p>
                    <Button type="button" variant="ghost" size="sm" className="h-8" onClick={copyErrorsToClipboard}>
                      {copiedErrors ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      <span className="ml-1">{copiedErrors ? 'Nusxalandi' : 'Nusxalash'}</span>
                    </Button>
                  </div>
                  <ul className="text-sm space-y-1 max-h-48 overflow-y-auto rounded-lg border p-2 bg-muted/40">
                    {importResult.errors.map((e, i) => (
                      <li key={i} className="text-destructive">
                        <span className="font-medium">Qator {e.row}</span>
                        {e.title ? ` (${e.title})` : ''}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DashboardPanel className="p-4 sm:p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-4 mb-5">
          <div className="relative w-full min-w-0 lg:max-w-md xl:max-w-lg 2xl:max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tovar nomi boʻyicha qidirish..."
              className="pl-9 min-h-[42px]"
              aria-label="Tovarlarni qidirish"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary" className="font-normal">
              Jami: <span className="ml-1 font-semibold text-foreground">{total}</span> ta
            </Badge>
            {total > 0 && (
              <span className="text-xs sm:text-sm">
                {from}–{to} koʻrsatilmoqda
              </span>
            )}
          </div>
        </div>

        {products.length === 0 ? (
          <DashboardEmptyState
            icon={Package}
            title={debouncedSearch ? 'Hech narsa topilmadi' : 'Tovarlar yoʻq'}
            description={
              debouncedSearch
                ? 'Boshqa soʻz bilan qidirib koʻring yoki filtrni toʻliq toʻzalang.'
                : 'Birinchi tovarni qoʻshing yoki Excel orqali import qiling.'
            }
          >
            {debouncedSearch ? (
              <Button type="button" variant="outline" onClick={() => setSearchInput('')}>
                Qidiruvni toʻzalash
              </Button>
            ) : (
              <Button asChild>
                <Link href="/seller/products/new">Yangi tovar</Link>
              </Button>
            )}
          </DashboardEmptyState>
        ) : (
          <>
            <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[2200px]:grid-cols-6">
              {products.map((p) => {
                const priceNum = Number(p.price);
                const compareNum = p.comparePrice != null ? Number(p.comparePrice) : null;
                const discount =
                  compareNum != null && compareNum > priceNum
                    ? Math.round((1 - priceNum / compareNum) * 100)
                    : null;
                const thumb = p.images?.[0]?.url;
                const stockV = stockVariant(p.stock);
                const stockCls = stockBadgeClass(p.stock);

                return (
                  <li key={p.id}>
                    <Card
                      className={cn(
                        'h-full overflow-hidden border-border/80 shadow-sm transition-shadow duration-200',
                        'hover:shadow-md hover:border-border',
                        !p.isActive && 'opacity-90',
                      )}
                    >
                      <div className="relative aspect-[5/4] w-full bg-muted">
                        {thumb ? (
                          <Image
                            src={thumb}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, (max-width:1280px) 33vw, (max-width:1536px) 25vw, 20vw"
                            unoptimized
                          />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                            <ImageIcon className="h-10 w-10 opacity-50" aria-hidden />
                            <span className="text-xs">Rasm yoʻq</span>
                          </div>
                        )}
                        {discount != null && discount > 0 && (
                          <Badge className="absolute left-2 top-2 shadow-sm">-{discount}%</Badge>
                        )}
                        <div className="absolute right-2 top-2 flex flex-wrap justify-end gap-1 max-w-[min(100%,11rem)]">
                          {!p.isActive && (
                            <Badge variant="destructive" className="shadow-sm text-[10px] px-1.5 py-0">
                              O‘chirilgan
                            </Badge>
                          )}
                          {p.isModerated ? (
                            <Badge
                              variant="default"
                              className="shadow-sm bg-green-600 hover:bg-green-600/90 text-[10px] px-1.5 py-0"
                            >
                              Katalogda
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="shadow-sm text-[10px] px-1.5 py-0">
                              Moderatsiya
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CardContent className="p-4 space-y-3">
                        <div className="space-y-1 min-w-0">
                          <h2 className="font-semibold text-sm sm:text-base leading-snug line-clamp-2" title={p.title}>
                            {p.title}
                          </h2>
                          {p.category?.name && (
                            <p className="text-xs text-muted-foreground truncate">{p.category.name}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="text-lg font-bold text-primary tabular-nums">{formatPrice(priceNum)} soʻm</span>
                          {compareNum != null && compareNum > priceNum && (
                            <span className="text-sm text-muted-foreground line-through tabular-nums">
                              {formatPrice(compareNum)}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 items-center text-xs">
                          <Badge variant={stockV} className={cn('font-medium tabular-nums', stockCls)}>
                            Qoldiq: {p.stock}
                          </Badge>
                          {p.sku ? (
                            <span className="text-muted-foreground truncate max-w-full" title={p.sku}>
                              SKU: {p.sku}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button asChild variant="default" size="sm" className="min-h-[36px] touch-manipulation flex-1 sm:flex-none">
                            <Link href={`/seller/products/${p.id}`}>
                              <Pencil className="h-3.5 w-3.5 mr-1.5" />
                              Tahrirlash
                            </Link>
                          </Button>
                          <Button asChild variant="outline" size="sm" className="min-h-[36px] touch-manipulation shrink-0">
                            <Link href={`/product/${p.id}`} target="_blank" rel="noopener noreferrer" title="Saytda ochish">
                              <ExternalLink className="h-3.5 w-3.5 sm:mr-1" />
                              <span className="hidden sm:inline">Koʻrish</span>
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>

            {totalPages > 1 && (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/60 pt-5">
                <p className="text-sm text-muted-foreground order-2 sm:order-1">
                  Sahifa <span className="font-medium text-foreground">{page}</span> / {totalPages}
                </p>
                <div className="flex items-center gap-2 order-1 sm:order-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-[40px] touch-manipulation"
                    disabled={page <= 1}
                    onClick={() => setPage((x) => Math.max(1, x - 1))}
                  >
                    <ChevronLeft className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Oldingi</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-[40px] touch-manipulation"
                    disabled={page >= totalPages}
                    onClick={() => setPage((x) => Math.min(totalPages, x + 1))}
                  >
                    <span className="hidden sm:inline">Keyingi</span>
                    <ChevronRight className="h-4 w-4 sm:ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DashboardPanel>
    </div>
  );
}
