'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { BarChart3, TrendingUp, Banknote, Wallet, Package, ShoppingBag } from 'lucide-react';

type Stats = {
  ordersCount: number;
  pendingOrdersCount?: number;
  totalRevenue: string;
  productsCount?: number;
  shopSlug?: string | null;
  commissionRate?: number | null;
  commission?: number;
  totalPaidToPlatform?: number;
  balance?: number;
};

type ChartPoint = { date: string; total: number; ordersCount: number };

const CHART_DAYS = [7, 30, 90] as const;

function formatChartDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' });
}

export default function SellerStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [chartDays, setChartDays] = useState<number>(30);
  const [chartLoading, setChartLoading] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const fetchStats = useCallback(() => {
    if (!token) return;
    apiFetch(`${API_URL}/seller/stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setStats);
  }, [token]);

  const fetchChart = useCallback(() => {
    if (!token) return;
    setChartLoading(true);
    apiFetch(`${API_URL}/seller/stats/sales-chart?days=${chartDays}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data: ChartPoint[]) => setChart(Array.isArray(data) ? data : []))
      .catch(() => setChart([]))
      .finally(() => setChartLoading(false));
  }, [token, chartDays]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchChart();
  }, [fetchChart]);

  if (!token) return <p>Kirish kerak</p>;
  if (!stats) return <Skeleton className="h-32 w-full" />;

  const totalSales = Number(stats.totalRevenue);
  const commission = stats.commission ?? 0;
  const totalPaid = stats.totalPaidToPlatform ?? 0;
  const balance = stats.balance ?? commission - totalPaid;
  const sellerEarnings = totalSales - commission;
  const chartTotal = chart.reduce((s, p) => s + p.total, 0);
  const chartOrders = chart.reduce((s, p) => s + p.ordersCount, 0);
  const maxChartValue = Math.max(...chart.map((x) => x.total), 1);

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold mb-2 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 sm:h-7 sm:w-7 shrink-0" />
          Statistika va komissiya
        </h1>
        <p className="text-muted-foreground mb-4 text-sm">Savdolar, sizga tegishli summa va marketpleys komissiyasi</p>
      </div>

      <div className="bg-muted/50 border border-border rounded-lg p-4 max-w-2xl">
        <p className="text-sm font-medium mb-1">Qanday ishlaydi</p>
        <ul className="text-xs sm:text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li><strong className="text-foreground">Savdolar</strong> — toʻlangan buyurtmalar jami (xaridor sizga toʻlaydi).</li>
          <li><strong className="text-foreground">Sizga tegishli</strong> — savdolardan sizning ulushingiz (savdo − komissiya).</li>
          <li><strong className="text-foreground">Komissiya</strong> — marketpleys ulushi. Uni platformaga naqd yoki karta orqali toʻlaysiz.</li>
          <li><strong className="text-foreground">Qoldiq</strong> — platformaga qancha toʻlashingiz kerak (yoki ortiqcha toʻlangan boʻlsa — hisobingizda).</li>
        </ul>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.productsCount != null && (
          <Card className="overflow-hidden">
            <CardHeader className="pb-1 px-4 sm:px-5 flex flex-row items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-sm sm:text-base">Tovarlar</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-5 pt-0"><p className="text-xl sm:text-2xl font-bold">{stats.productsCount}</p></CardContent>
          </Card>
        )}
        <Card className="overflow-hidden">
          <CardHeader className="pb-1 px-4 sm:px-5 flex flex-row items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-sm sm:text-base">Buyurtmalar</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-5 pt-0">
            <p className="text-xl sm:text-2xl font-bold">{stats.ordersCount}</p>
            {stats.pendingOrdersCount != null && stats.pendingOrdersCount > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Tasdiqlash kutilmoqda: {stats.pendingOrdersCount}</p>
            )}
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader className="pb-1 px-4 sm:px-5 flex flex-row items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-sm sm:text-base">Savdolar (jami)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-5 pt-0"><p className="text-lg sm:text-xl font-bold">{formatPrice(totalSales)} soʻm</p></CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader className="pb-1 px-4 sm:px-5 flex flex-row items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <Banknote className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-sm sm:text-base">Sizga tegishli</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-5 pt-0"><p className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400">{formatPrice(sellerEarnings)} soʻm</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-1 px-4 sm:px-5"><CardTitle className="text-sm sm:text-base">Komissiya (marketpleys)</CardTitle></CardHeader>
          <CardContent className="px-4 sm:px-5 pt-0">
            <p className="text-xl font-bold">{formatPrice(commission)} soʻm</p>
            {stats.commissionRate != null && <p className="text-xs text-muted-foreground mt-0.5">{stats.commissionRate}%</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 px-4 sm:px-5"><CardTitle className="text-sm sm:text-base">Platformaga toʻlangan</CardTitle></CardHeader>
          <CardContent className="px-4 sm:px-5 pt-0"><p className="text-xl font-bold">{formatPrice(totalPaid)} soʻm</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 px-4 sm:px-5"><CardTitle className="text-sm sm:text-base">Qoldiq (toʻlash kerak)</CardTitle></CardHeader>
          <CardContent className="px-4 sm:px-5 pt-0">
            {balance <= 0 ? (
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {balance === 0 ? 'Toʻlandi' : `+${formatPrice(-balance)} soʻm (hisobingizda)`}
              </p>
            ) : (
              <p className="text-xl font-bold">{formatPrice(balance)} soʻm</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 shrink-0" />
            Savdolar (kunlik)
          </CardTitle>
          <div className="flex gap-1">
            {CHART_DAYS.map((d) => (
              <Button
                key={d}
                variant={chartDays === d ? 'default' : 'outline'}
                size="sm"
                className="min-h-8"
                onClick={() => setChartDays(d)}
                disabled={chartLoading}
              >
                {d} kun
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {chartLoading ? (
            <Skeleton className="h-[200px] w-full rounded-lg" />
          ) : chart.length > 0 ? (
            <>
              <div className="flex items-end gap-[2px] sm:gap-0.5 h-[200px] rounded-lg bg-muted/30 p-2" aria-label="Savdolar grafigi">
                {chart.map((p) => {
                  const pct = maxChartValue > 0 ? (p.total / maxChartValue) * 100 : 0;
                  return (
                    <div
                      key={p.date}
                      className="flex-1 min-w-0 flex flex-col items-center justify-end group"
                      title={`${formatChartDate(p.date)}: ${formatPrice(p.total)} soʻm, ${p.ordersCount} ta buyurtma`}
                    >
                      <div
                        className="w-full max-w-[20px] sm:max-w-none bg-primary hover:bg-primary/90 rounded-t transition-all min-h-[2px]"
                        style={{ height: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2 px-1">
                <span>{chart[0] ? formatChartDate(chart[0].date) : ''}</span>
                <span>{chart.length ? formatChartDate(chart[chart.length - 1].date) : ''}</span>
              </div>
              <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t text-sm">
                <span><strong>Jami (tanlangan davr):</strong> {formatPrice(chartTotal)} soʻm</span>
                <span><strong>Buyurtmalar:</strong> {chartOrders} ta</span>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-center py-12">Maʼlumot yoʻq yoki yuklanmoqda</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
