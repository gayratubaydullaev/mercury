'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { isGuestFavorite, toggleGuestFavorite as toggleGuest } from '@/lib/guest-favorites';

export function FavoriteButton({
  productId,
  initial,
  className,
  iconClassName,
  activeClassName,
  onToggle,
}: {
  productId: string;
  initial?: boolean;
  className?: string;
  /** Class for the heart icon (e.g. responsive size) */
  iconClassName?: string;
  /** Applied when item is in favorites (e.g. red background) */
  activeClassName?: string;
  /** Called after successful toggle (e.g. to remove card from favorites list when unfavorited) */
  onToggle?: (isFav: boolean) => void;
}) {
  const router = useRouter();
  const [isFav, setIsFav] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const token = localStorage.getItem('accessToken');
    if (token) setIsFav(!!initial);
    else setIsFav(isGuestFavorite(productId));
  }, [mounted, initial, productId]);

  useEffect(() => {
    if (!mounted) return;
    const token = localStorage.getItem('accessToken');
    if (token) return;
    const handler = () => setIsFav(isGuestFavorite(productId));
    window.addEventListener('guest-favorites-changed', handler);
    return () => window.removeEventListener('guest-favorites-changed', handler);
  }, [mounted, productId]);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      const next = toggleGuest(productId);
      setIsFav(next);
      toast.success(next ? "Sevimlilarga qoʻshildi" : "Sevimlilardan oʻchirildi");
      onToggle?.(next);
      return;
    }
    setLoading(true);
    const next = !isFav;
    setIsFav(next);
    const url = next ? `${API_URL}/favorites` : `${API_URL}/favorites/${productId}`;
    const authToken = localStorage.getItem('accessToken');
    apiFetch(url, {
      method: next ? 'POST' : 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
      body: next ? JSON.stringify({ productId }) : undefined,
    })
      .then((r) => {
        if (!r.ok) {
          if (r.status === 401) router.push('/auth/login?next=' + encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/') + '&reason=favorites');
          setIsFav(!next);
          toast.error('Xatolik yuz berdi');
          return;
        }
        toast.success(next ? "Sevimlilarga qoʻshildi" : "Sevimlilardan oʻchirildi");
        onToggle?.(next);
      })
      .catch(() => {
        setIsFav(!next);
        toast.error('Xatolik yuz berdi');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Button
      variant="secondary"
      size="icon"
      className={cn(className, mounted && isFav && activeClassName)}
      onClick={toggle}
      disabled={loading}
      aria-label="Sevimlilar"
      title={mounted && isFav ? "Sevimlilardan o'chirish" : "Sevimlilarga qo'shish"}
    >
      <Heart className={cn('h-5 w-5 transition-all', iconClassName, mounted && isFav && 'fill-red-500 text-red-500')} />
    </Button>
  );
}
