'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { MessageSquare, Star } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  sellerReply: string | null;
  createdAt: string;
  user: { firstName: string; lastName: string };
  product: { id: string; title: string };
};

export default function SellerReviewsPage() {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const load = () => {
    if (!token) return;
    apiFetch(`${API_URL}/seller/reviews`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setReviews)
      .catch(() => setReviews([]));
  };

  useEffect(() => {
    load();
  }, [token]);

  const handleReply = (reviewId: string) => {
    const text = (drafts[reviewId] ?? '').trim();
    if (!token || !text) return;
    setReplyingId(reviewId);
    apiFetch(`${API_URL}/reviews/${reviewId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reply: text }),
    })
      .then(() => {
        toast.success('Javob yuborildi');
        setDrafts((prev) => { const { [reviewId]: _omit, ...rest } = prev; return rest; });
        setReplyingId(null);
        load();
      })
      .catch(() => {
        toast.error('Yuborib boʻlmadi');
        setReplyingId(null);
      });
  };

  if (!token) return <DashboardAuthGate />;
  if (reviews === null) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <DashboardPageHeader
        eyebrow="Sotuvchi kabineti"
        title="Sharhlar"
        description="Xaridorlar fikrlariga javob bering."
      />

      <Card>
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            Mahsulotlar boʻyicha sharhlar ({reviews.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          {reviews.length === 0 ? (
            <DashboardEmptyState icon={MessageSquare} title="Hali sharhlar yoʻq" description="Birinchi sharh kelganda u shu yerda koʻrinadi." />
          ) : (
            <ul className="space-y-4">
              {reviews.map((r) => (
                <li key={r.id} className="p-4 rounded-lg border bg-card space-y-3">
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
                  <p className="text-sm text-muted-foreground">
                    Tovar: <Link href={`/product/${r.product.id}`} className="text-primary underline">{r.product.title}</Link>
                  </p>
                  {r.comment && <p className="text-sm">{r.comment}</p>}
                  {r.sellerReply ? (
                    <div className="text-sm pl-3 border-l-2 border-primary/30 text-muted-foreground bg-muted/50 rounded-r py-2 px-3">
                      <span className="font-medium text-foreground">Sizning javobingiz:</span> {r.sellerReply}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        placeholder="Javob yozing..."
                        value={drafts[r.id] ?? ''}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                        maxLength={1000}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleReply(r.id)}
                        disabled={!(drafts[r.id] ?? '').trim() || replyingId === r.id}
                      >
                        {replyingId === r.id ? 'Yuborilmoqda...' : 'Javob yuborish'}
                      </Button>
                    </div>
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
