'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { BarChart3, Store, TrendingUp, Users, Package, ShoppingBag, Banknote, FileCheck } from 'lucide-react';

type PayoutRow = {
  seller: { id: string; firstName: string; lastName: string; email: string };
  total: number;
  commission: number;
  ordersCount: number;
  totalPaid?: number;
  balance?: number;
};

type SalesChartPoint = { date: string; total: number; ordersCount: number };

type Stats = {
  usersCount: number;
  productsCount: number;
  ordersCount: number;
  paidOrdersCount?: number;
  totalRevenue: string;
  pendingProductsCount?: number;
  pendingReviewsCount?: number;
};

const CHART_DAYS = [7, 30, 90] as const;

function formatChartDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' });
}

export default function AdminStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [payouts, setPayouts] = useState<{ data: PayoutRow[] } | null>(null);
  const [salesChart, setSalesChart] = useState<SalesChartPoint[]>([]);
  const [chartDays, setChartDays] = useState<number>(30);
  const [chartLoading, setChartLoading] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const fetchStats = useCallback(() => {
    if (!token) return;
    apiFetch(`${API_URL}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setStats);
  }, [token]);

  const fetchPayouts = useCallback(() => {
    if (!token) return;
    apiFetch(`${API_URL}/admin/payouts?limit=100`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setPayouts)
      .catch(() => setPayouts({ data: [] }));
  }, [token]);

  const fetchChart = useCallback(() => {
    if (!token) return;
    setChartLoading(true);
    apiFetch(`${API_URL}/admin/stats/sales-chart?days=${chartDays}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data: SalesChartPoint[]) => {
        setSalesChart(Array.isArray(data) ? data : []);
      })
      .catch(() => setSalesChart([]))
      .finally(() => setChartLoading(false));
  }, [token, chartDays]);

  useEffect(() => {
    fetchStats();
    fetchPayouts();
  }, [fetchStats, fetchPayouts]);

  useEffect(() => {
    fetchChart();
  }, [fetchChart]);

  if (!token) return <p>Kirish kerak</p>;
  if (!stats) return <Skeleton className="h-32 w-full" />;

  const sellerRows = Array.isArray(payouts?.data) ? payouts.data : [];
  const totalCommission = sellerRows.reduce((s, r) => s + (r.commission ?? 0), 0);
  const totalPaidBySellers = sellerRows.reduce((s, r) => s + (r.totalPaid ?? 0), 0);
  const totalBalance = sellerRows.reduce((s, r) => s + (r.balance ?? 0), 0);
  const chartTotal = salesChart.reduce((s, p) => s + p.total, 0);
  const chartOrders = salesChart.reduce((s, p) => s + p.ordersCount, 0);
  const maxChartValue = Math.max(...salesChart.map((x) => x.total), 1);

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0 max-w-full">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold mb-2 flex flex-wrap items-center gap-2">
          <BarChart3 className="h-6 w-6 sm:h-7 sm:w-7 shrink-0" />
          Analitika
        </h1>
        <p className="text-muted-foreground mb-4 sm:mb-6 text-sm sm:text-base">Platforma statistikasi va savdolar</p>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="overflow-hidden">
            <CardHeader className="pb-1 sm:pb-2 px-4 sm:px-5 flex flex-row items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-sm sm:text-base">Foydalanuvchilar</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-5 pt-0">
              <p className="text-xl sm:text-2xl font-bold">{stats.usersCount}</p>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader className="pb-1 sm:pb-2 px-4 sm:px-5 flex flex-row items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-sm sm:text-base">Tovarlar</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-5 pt-0">
              <p className="text-xl sm:text-2xl font-bold">{stats.productsCount}</p>
              {stats.pendingProductsCount != null && stats.pendingProductsCount > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Moderatsiya: {stats.pendingProductsCount}</p>
              )}
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader className="pb-1 sm:pb-2 px-4 sm:px-5 flex flex-row items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <ShoppingBag className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-sm sm:text-base">Buyurtmalar</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-5 pt-0">
              <p className="text-xl sm:text-2xl font-bold">{stats.ordersCount}</p>
              {stats.paidOrdersCount != null && (
                <p className="text-xs text-muted-foreground mt-0.5">Toʻlangan: {stats.paidOrdersCount}</p>
              )}
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader className="pb-1 sm:pb-2 px-4 sm:px-5 flex flex-row items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <Banknote className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-sm sm:text-base">Savdolar (jami)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-5 pt-0">
              <p className="text-lg sm:text-2xl font-bold break-words">{formatPrice(Number(stats.totalRevenue))} soʻm</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mt-4">
          <Card>
            <CardHeader className="pb-1 px-4 sm:px-5"><CardTitle className="text-sm">Komissiya (jami)</CardTitle></CardHeader>
            <CardContent className="px-4 sm:px-5 pt-0"><p className="text-lg font-bold">{formatPrice(totalCommission)} soʻm</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 px-4 sm:px-5"><CardTitle className="text-sm">Sotuvchilardan qabul qilingan</CardTitle></CardHeader>
            <CardContent className="px-4 sm:px-5 pt-0"><p className="text-lg font-bold text-green-600 dark:text-green-400">{formatPrice(totalPaidBySellers)} soʻm</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 px-4 sm:px-5"><CardTitle className="text-sm">Qoldiq (sotuvchilar)</CardTitle></CardHeader>
            <CardContent className="px-4 sm:px-5 pt-0">
              <p className="text-lg font-bold">{totalBalance <= 0 ? (totalBalance === 0 ? 'Toʻlandi' : `+${formatPrice(-totalBalance)}`) : `${formatPrice(totalBalance)} soʻm`}</p>
            </CardContent>
          </Card>
        </div>

        {(stats.pendingProductsCount != null && stats.pendingProductsCount > 0) || (stats.pendingReviewsCount != null && stats.pendingReviewsCount > 0) ? (
          <Card className="mt-4 border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="py-4 px-4 sm:px-5 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <span className="font-medium text-sm">Moderatsiya kutilmoqda:</span>
              </div>
              {stats.pendingProductsCount != null && stats.pendingProductsCount > 0 && (
                <Button variant="outline" size="sm" className="h-8" asChild>
                  <Link href="/admin/products">Tovarlar ({stats.pendingProductsCount})</Link>
                </Button>
              )}
              {stats.pendingReviewsCount != null && stats.pendingReviewsCount > 0 && (
                <Button variant="outline" size="sm" className="h-8" asChild>
                  <Link href="/admin/reviews">Sharhlar ({stats.pendingReviewsCount})</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : null}
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
          ) : salesChart.length > 0 ? (
            <>
              <div className="flex items-end gap-[2px] sm:gap-0.5 h-[200px] rounded-lg bg-muted/30 p-2" aria-label="Savdolar grafigi">
                {salesChart.map((p) => {
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
                <span>{salesChart[0] ? formatChartDate(salesChart[0].date) : ''}</span>
                <span>{salesChart.length ? formatChartDate(salesChart[salesChart.length - 1].date) : ''}</span>
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

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
            <Store className="h-5 w-5 shrink-0" />
            Sotuvchilar boʻyicha (komissiya hisobi)
          </h2>
          <Button variant="outline" size="sm" className="min-h-[40px] touch-manipulation w-fit" asChild>
            <Link href="/admin/payouts">Barchasi — Komissiya hisobi</Link>
          </Button>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto -mx-0 rounded-b-xl">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-2 px-3 font-medium">Sotuvchi</th>
                    <th className="text-right py-2 px-3 font-medium">Buyurtmalar</th>
                    <th className="text-right py-2 px-3 font-medium">Savdolar</th>
                    <th className="text-right py-2 px-3 font-medium">Sotuvchi oladi</th>
                    <th className="text-right py-2 px-3 font-medium">Komissiya</th>
                    <th className="text-right py-2 px-3 font-medium">Bizga toʻlangan</th>
                    <th className="text-right py-2 px-3 font-medium">Qoldiq</th>
                  </tr>
                </thead>
                <tbody>
                  {sellerRows.slice(0, 10).map((row, i) => (
                    <tr key={row.seller?.id ?? i} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-3">
                        <p className="font-medium">{row.seller?.firstName} {row.seller?.lastName}</p>
                        <p className="text-muted-foreground text-xs">{row.seller?.email}</p>
                      </td>
                      <td className="py-2 px-3 text-right">{row.ordersCount}</td>
                      <td className="py-2 px-3 text-right">{formatPrice(row.total)} soʻm</td>
                      <td className="py-2 px-3 text-right">{formatPrice(row.total - row.commission)} soʻm</td>
                      <td className="py-2 px-3 text-right">{formatPrice(row.commission)} soʻm</td>
                      <td className="py-2 px-3 text-right">{formatPrice(row.totalPaid ?? 0)} soʻm</td>
                      <td className="py-2 px-3 text-right font-medium">
                        {row.balance === 0 ? (
                          <span className="text-muted-foreground">Toʻlandi</span>
                        ) : (row.balance ?? 0) < 0 ? (
                          <span className="text-green-600 dark:text-green-400">+{formatPrice(-(row.balance ?? 0))}</span>
                        ) : (
                          formatPrice(row.balance ?? 0) + ' soʻm'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sellerRows.length === 0 && <p className="text-muted-foreground text-center py-6">Maʼlumot yoʻq</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
