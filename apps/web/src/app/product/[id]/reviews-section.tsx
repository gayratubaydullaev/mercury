'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { API_URL, cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

interface Review {
  id: string;
  rating: number;
  comment?: string | null;
  sellerReply?: string | null;
  createdAt?: string;
  user: { firstName: string; lastName: string };
}

interface CanReviewResult {
  canReview: boolean;
  purchaseCount: number;
  reviewCount: number;
}

const MONTHS_UZ = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

function formatReviewDate(dateStr: string | undefined) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = d.getDate();
  const month = MONTHS_UZ[d.getMonth()] ?? '';
  const year = d.getFullYear();
  return `${day}-${month}, ${year}`;
}

function refetchReviews(productId: string): Promise<Review[]> {
  return apiFetch(`${API_URL}/reviews/product/${productId}`).then((r) => r.json());
}

export function ReviewsSection({
  productId,
  initialReviews,
  showViewAllButton = true,
  compact = true,
}: {
  productId: string;
  initialReviews?: Review[];
  showViewAllButton?: boolean;
  /** false = на всех экранах вертикальный список (страница «все отзывы») */
  compact?: boolean;
}) {
  const [reviews, setReviews] = useState<Review[] | null>(initialReviews ?? null);
  const [mounted, setMounted] = useState(false);
  const [formRating, setFormRating] = useState(0);
  const [formComment, setFormComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [canReview, setCanReview] = useState<CanReviewResult | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollRefMobile = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, scrollLeft: 0 });
  const isDraggingRef = useRef(false);
  const CARD_GAP = 16;
  const stepMobile = 356; // ~одна карточка на мобиле (340 + gap)

  const stopDrag = useRef(() => {});
  useEffect(() => {
    stopDrag.current = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (scrollRef.current) scrollRef.current.style.scrollBehavior = '';
    };
    function onMouseMove(e: MouseEvent) {
      if (!scrollRef.current || !isDraggingRef.current) return;
      e.preventDefault();
      const el = scrollRef.current;
      const dx = dragStart.current.x - e.clientX;
      el.scrollLeft = dragStart.current.scrollLeft + dx;
    }
    function onMouseUp() {
      stopDrag.current();
    }
    document.addEventListener('mousemove', onMouseMove, { passive: false });
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (initialReviews != null) return;
    refetchReviews(productId).then(setReviews);
  }, [productId, initialReviews]);

  const token = mounted && typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const isLoggedIn = !!token;

  useEffect(() => {
    if (!isLoggedIn || !productId) {
      setCanReview(null);
      return;
    }
    apiFetch(`${API_URL}/reviews/product/${productId}/can-review`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: CanReviewResult) => setCanReview(data))
      .catch(() => setCanReview(null));
  }, [isLoggedIn, productId, token]);

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (formRating < 1 || formRating > 5 || !token) return;
    setSubmitting(true);
    apiFetch(`${API_URL}/reviews/product/${productId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rating: formRating, comment: formComment.trim() || undefined }),
    })
      .then(async (r) => {
        const err = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(err?.message || 'Xatolik');
        toast.success('Sharhingiz saqlandi');
        setFormRating(0);
        setFormComment('');
        setCanReview((prev) =>
          prev ? { ...prev, canReview: prev.purchaseCount > prev.reviewCount + 1, reviewCount: prev.reviewCount + 1 } : null
        );
        return refetchReviews(productId);
      })
      .then(setReviews)
      .catch((e: Error) => toast.error(e?.message || 'Sharh yozib boʻlmadi. Keyinroq urinib koʻring.'))
      .finally(() => setSubmitting(false));
  };

  if (!reviews) return <div className="animate-pulse h-24 rounded bg-muted" />;

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const rounded = Math.round(avg * 10) / 10;

  return (
    <div className="space-y-2 sm:space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <h2 className="text-lg sm:text-xl font-bold text-foreground">Sharhlar</h2>
          {reviews.length > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <div className="flex items-center gap-1 text-yellow-600 font-bold">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span>{rounded}</span>
              </div>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{reviews.length} ta sharh</span>
            </div>
          )}
        </div>
        {showViewAllButton && reviews.length > 0 && (
          <Button variant="outline" size="sm" className="shrink-0" asChild>
            <Link href={`/product/${productId}/reviews`}>Barcha sharhlarni koʻrish</Link>
          </Button>
        )}
      </div>

      {/* Сначала список отзывов (под заголовком Sharhlar) */}
      {reviews.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground bg-muted/50 rounded-2xl border border-dashed border-border">
          <p>Hali sharh yoʻq. Birinchi sharhni siz yozing.</p>
        </div>
      ) : (
        <>
          {/* Десктоп (compact): один ряд, 3 отзыва, кнопки < > и перетаскивание мышью, без ползунка */}
          {compact && (
          <div className="hidden lg:block relative group">
            <div
              ref={scrollRef}
              className={cn(
                'overflow-x-auto -mx-1 px-1 select-none touch-pan-x touch-manipulation',
                '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                isDragging ? 'cursor-grabbing' : 'cursor-grab'
              )}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              onMouseDown={(e) => {
                if (scrollRef.current && e.button === 0) {
                  e.preventDefault();
                  isDraggingRef.current = true;
                  setIsDragging(true);
                  dragStart.current = { x: e.clientX, scrollLeft: scrollRef.current.scrollLeft };
                  scrollRef.current.style.scrollBehavior = 'auto';
                  document.body.style.cursor = 'grabbing';
                  document.body.style.userSelect = 'none';
                }
              }}
            >
            <ul className="flex gap-4 w-max">
              {reviews.map((r) => (
                <li
                  key={r.id}
                  className="flex-shrink-0 w-[560px] min-h-[220px] rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow text-base"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground text-lg">
                      {r.user.firstName} {r.user.lastName}
                    </span>
                    <span className="flex items-center gap-0.5 text-yellow-500" title={`${r.rating} / 5`}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star
                          key={i}
                          className={`w-6 h-6 ${i <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'}`}
                        />
                      ))}
                    </span>
                    {r.createdAt && (
                      <span className="text-muted-foreground text-sm mt-0.5">
                        {formatReviewDate(r.createdAt)}
                      </span>
                    )}
                  </div>
                  {r.comment && (
                    <p className="text-muted-foreground mt-3 leading-relaxed line-clamp-6 text-[15px]">{r.comment}</p>
                  )}
                  {r.sellerReply && (
                    <p className="mt-4 pl-3 border-l-2 border-primary/30 text-muted-foreground bg-muted/50 rounded-r py-2 line-clamp-3 text-[15px]">
                      <span className="font-medium text-foreground">Sotuvchi javobi:</span> {r.sellerReply}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            </div>
            <button
              type="button"
              onClick={() => {
                if (scrollRef.current) scrollRef.current.scrollBy({ left: -576, behavior: 'smooth' });
              }}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 w-10 h-10 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-foreground opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
              aria-label="Oldingi"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (scrollRef.current) scrollRef.current.scrollBy({ left: 576, behavior: 'smooth' });
              }}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 w-10 h-10 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-foreground opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
              aria-label="Keyingi"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          )}
          {/* Мобильный compact: один отзыв на экран, горизонтальная прокрутка влево/вправо */}
          {compact && (
          <div className="lg:hidden relative -mx-1 px-1">
            <div
              ref={scrollRefMobile}
              className={cn(
                'overflow-x-auto snap-x snap-mandatory touch-pan-x touch-manipulation',
                '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
              )}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <ul className="flex gap-4 w-max pr-3">
                {reviews.map((r) => (
                  <li
                    key={r.id}
                    className="flex-shrink-0 w-[min(340px,calc(100vw-32px))] min-w-[280px] snap-center min-h-[200px] rounded-xl border border-border bg-card p-4 shadow-sm text-sm"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">
                        {r.user.firstName} {r.user.lastName}
                      </span>
                      <span className="flex items-center gap-0.5 text-yellow-500" title={`${r.rating} / 5`}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            className={`w-5 h-5 ${i <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'}`}
                          />
                        ))}
                      </span>
                      {r.createdAt && (
                        <span className="text-muted-foreground text-xs mt-0.5">
                          {formatReviewDate(r.createdAt)}
                        </span>
                      )}
                    </div>
                    {r.comment && (
                      <p className="text-muted-foreground mt-2 leading-relaxed line-clamp-4">{r.comment}</p>
                    )}
                    {r.sellerReply && (
                      <p className="mt-3 pl-2 border-l-2 border-primary/30 text-muted-foreground bg-muted/50 rounded-r py-1.5 line-clamp-2 text-xs">
                        <span className="font-medium text-foreground">Sotuvchi:</span> {r.sellerReply}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            {reviews.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (scrollRefMobile.current) scrollRefMobile.current.scrollBy({ left: -stepMobile, behavior: 'smooth' });
                  }}
                  className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-foreground active:bg-muted"
                  aria-label="Oldingi"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (scrollRefMobile.current) scrollRefMobile.current.scrollBy({ left: stepMobile, behavior: 'smooth' });
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-foreground active:bg-muted"
                  aria-label="Keyingi"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
          )}
          {/* Вертикальный список: только на странице «Barcha sharhlar» (!compact) */}
          {!compact && (
          <ul className="space-y-4">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground">
                    {r.user.firstName} {r.user.lastName}
                  </span>
                  <span className="flex items-center gap-0.5 text-yellow-500" title={`${r.rating} / 5`}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${i <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'}`}
                      />
                    ))}
                  </span>
                  {r.createdAt && (
                    <span className="text-muted-foreground text-xs">
                      {formatReviewDate(r.createdAt)}
                    </span>
                  )}
                </div>
                {r.comment && (
                  <p className="text-muted-foreground text-sm mt-2 leading-relaxed">{r.comment}</p>
                )}
                {r.sellerReply && (
                  <p className="text-sm mt-3 pl-3 border-l-2 border-primary/30 text-muted-foreground bg-muted/50 rounded-r py-1">
                    <span className="font-medium text-foreground">Sotuvchi javobi:</span> {r.sellerReply}
                  </p>
                )}
              </li>
            ))}
          </ul>
          )}
        </>
      )}

      {/* Форма отзыва — под списком отзывов; только для купивших товар */}
      {!isLoggedIn ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
          Sharh yozish uchun{' '}
          <Link href={`/auth/login?next=${encodeURIComponent('/product/' + productId)}`} className="text-primary font-medium underline">
            tizimga kiring
          </Link>
          .
        </div>
      ) : canReview === null ? (
        <div className="rounded-xl border border-border bg-muted/30 p-4 animate-pulse h-24" />
      ) : !canReview.canReview ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
          {canReview.purchaseCount === 0
            ? 'Sharh yozish uchun avval ushbu mahsulotni sotib oling.'
            : `Siz ushbu mahsulot boʻyicha ${canReview.reviewCount} ta sharh yozgansiz (sotib olganlar: ${canReview.purchaseCount}). Qoʻshimcha sharh yozish uchun mahsulotni qayta sotib oling.`}
        </div>
      ) : (
        <form onSubmit={handleSubmitReview} className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-medium text-foreground">Sharh yozing</p>
            {canReview.purchaseCount > 1 && (
              <p className="text-xs text-muted-foreground">
                Sotib olganlar: {canReview.purchaseCount}, yozilgan sharhlar: {canReview.reviewCount}. Yana {canReview.purchaseCount - canReview.reviewCount} ta sharh yozishingiz mumkin.
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setFormRating(i)}
                className="p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-primary/50"
                aria-label={`${i} yulduz`}
              >
                <Star
                  className={`w-8 h-8 transition-colors ${i <= formRating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40 hover:text-yellow-400/70'}`}
                />
              </button>
            ))}
          </div>
          <textarea
            placeholder="Izoh (ixtiyoriy)"
            value={formComment}
            onChange={(e) => setFormComment(e.target.value)}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            maxLength={2000}
          />
          <Button type="submit" disabled={formRating < 1 || submitting}>
            {submitting ? 'Yuborilmoqda...' : 'Yuborish'}
          </Button>
        </form>
      )}
    </div>
  );
}
