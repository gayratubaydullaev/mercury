'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { MessageSquare, Star, Trash2 } from 'lucide-react';

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  sellerReply: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string };
  product: { id: string; title: string };
};

export default function AdminReviewsPage() {
  const [data, setData] = useState<{ data: Review[]; total: number; page: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const load = () => {
    if (!token) return;
    apiFetch(`${API_URL}/admin/reviews?page=1&limit=50`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ data: [], total: 0, page: 1, totalPages: 0 }));
  };

  useEffect(() => {
    load();
  }, [token]);

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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <MessageSquare className="h-7 w-7" />
        Sharhlar
      </h1>

      <Card>
        <CardHeader><CardTitle>Barcha sharhlar ({data.total})</CardTitle></CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <p className="text-muted-foreground">Sharhlar yoʻq.</p>
          ) : (
            <ul className="space-y-4">
              {reviews.map((r) => (
                <li key={r.id} className="p-4 rounded-lg border bg-card space-y-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{r.user.firstName} {r.user.lastName}</span>
                      <span className="flex items-center gap-0.5 text-yellow-500">
                        {[1,2,3,4,5].map((i) => (
                          <Star key={i} className={`w-4 h-4 ${i <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'}`} />
                        ))}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString('uz-UZ')}
                      </span>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(r.id)}
                      disabled={loading || deletingId === r.id}
                    >
                      <Trash2 className="h-4 w-4" />
                      Oʻchirish
                    </Button>
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
