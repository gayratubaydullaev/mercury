'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { MessageSquare, Star, Trash2, Check, X } from 'lucide-react';

const PAGE_SIZE = 20;

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  sellerReply: string | null;
  isModerated: boolean;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string };
  product: { id: string; title: string };
};

export default function AdminReviewsPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<{ data: Review[]; total: number; page: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'false' | 'true' | ''>('');
  const [page, setPage] = useState(1);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  useEffect(() => {
    if (searchParams.get('filter') === 'pending') setFilter('false');
  }, [searchParams]);

  const load = () => {
    if (!token) return;
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (filter) params.set('isModerated', filter);
    apiFetch(`${API_URL}/admin/reviews?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ data: [], total: 0, page: 1, totalPages: 0 }));
  };

  useEffect(() => {
    load();
  }, [token, filter, page]);

  const handleModerate = (id: string, approve: boolean) => {
    if (!token) return;
    setLoading(true);
    apiFetch(`${API_URL}/reviews/${id}/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ approve }),
    })
      .then(() => {
        toast.success(approve ? 'Sharh tasdiqlandi' : 'Sharh rad etildi');
        load();
      })
      .catch(() => toast.error('Amal bajarilmadi'))
      .finally(() => setLoading(false));
  };

  const handleDelete = (id: string) => {
    if (!token) return;
    setDeletingId(id);
    apiFetch(`${API_URL}/reviews/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(() => {
        toast.success('Sharh oʻchirildi');
        load();
      })
      .catch(() => toast.error('Oʻchirib boʻlmadi'))
      .finally(() => setDeletingId(null));
  };

  if (!token) return <p>Kirish kerak</p>;
  if (data === null) return <Skeleton className="h-64 w-full" />;

  const reviews = data.data ?? [];

  return (
    <div className="space-y-6 min-w-0 max-w-full">
      <h1 className="text-xl sm:text-2xl font-bold flex flex-wrap items-center gap-2">
        <MessageSquare className="h-6 w-6 sm:h-7 sm:w-7 shrink-0" />
        Sharhlar (moderatsiya)
      </h1>

      <div className="flex gap-2 flex-wrap items-center">
        <Button variant={filter === '' ? 'default' : 'outline'} size="sm" className="min-h-[40px] touch-manipulation" onClick={() => { setFilter(''); setPage(1); }}>Barchasi</Button>
        <Button variant={filter === 'false' ? 'default' : 'outline'} size="sm" className="min-h-[40px] touch-manipulation" onClick={() => { setFilter('false'); setPage(1); }}>Kutilmoqda</Button>
        <Button variant={filter === 'true' ? 'default' : 'outline'} size="sm" className="min-h-[40px] touch-manipulation" onClick={() => { setFilter('true'); setPage(1); }}>Tasdiqlangan</Button>
        {data && data.totalPages > 1 && (
          <div className="flex items-center gap-2 sm:ml-4 flex-wrap">
            <Button variant="outline" size="sm" className="min-h-[40px] touch-manipulation" disabled={data.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Oldingi</Button>
            <span className="text-sm text-muted-foreground">Sahifa {data.page} / {data.totalPages}</span>
            <Button variant="outline" size="sm" className="min-h-[40px] touch-manipulation" disabled={data.page >= data.totalPages} onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}>Keyingi</Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base sm:text-lg">Sharhlar ({data.total})</CardTitle></CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <p className="text-muted-foreground py-4">Sharhlar yoʻq.</p>
          ) : (
            <ul className="space-y-4">
              {reviews.map((r) => (
                <li key={r.id} className="p-4 sm:p-5 rounded-xl border bg-card space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-medium">{r.user.firstName} {r.user.lastName}</span>
                      <span className="flex items-center gap-0.5 text-yellow-500 shrink-0">
                        {[1,2,3,4,5].map((i) => (
                          <Star key={i} className={`w-4 h-4 ${i <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'}`} />
                        ))}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString('uz-UZ')}
                      </span>
                      {r.isModerated ? (
                        <span className="text-xs text-green-600 font-medium">Tasdiqlangan</span>
                      ) : (
                        <span className="text-xs text-amber-600 font-medium">Kutilmoqda</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {!r.isModerated && (
                        <>
                          <Button size="sm" className="min-h-[40px] touch-manipulation text-green-600" onClick={() => handleModerate(r.id, true)} disabled={loading}>
                            <Check className="h-4 w-4 mr-1" /> Tasdiqlash
                          </Button>
                          <Button size="sm" variant="outline" className="min-h-[40px] touch-manipulation" onClick={() => handleModerate(r.id, false)} disabled={loading}>
                            <X className="h-4 w-4 mr-1" /> Rad etish
                          </Button>
                        </>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        className="min-h-[40px] touch-manipulation"
                        onClick={() => handleDelete(r.id)}
                        disabled={loading || deletingId === r.id}
                      >
                        <Trash2 className="h-4 w-4" />
                        Oʻchirish
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Tovar: <Link href={`/product/${r.product.id}`} className="text-primary underline">{r.product.title}</Link>
                  </p>
                  {r.comment && <p className="text-sm">{r.comment}</p>}
                  {r.sellerReply && (
                    <p className="text-sm pl-3 border-l-2 border-primary/30 text-muted-foreground">
                      <span className="font-medium text-foreground">Sotuvchi javobi:</span> {r.sellerReply}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
