'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { useTelegramBackHandler } from '@/contexts/telegram-back-handler-context';
import { ChevronRight, Store } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

type ShopInfo = { id: string; name: string; slug: string; description: string | null };

export function CatalogTitle() {
  const searchParams = useSearchParams();
  const shopSlug = searchParams.get('shop');
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!shopSlug) {
      setShop(null);
      return;
    }
    apiFetch(`${API_URL}/products/shop-info/${encodeURIComponent(shopSlug)}`)
      .then((r) => r.json())
      .then((s: ShopInfo) => setShop(s))
      .catch(() => setShop(null));
  }, [shopSlug]);

  useTelegramBackHandler(modalOpen, () => setModalOpen(false));

  if (!shopSlug) {
    return null;
  }

  const displayName = shop?.name ?? shopSlug;

  return (
    <>
      <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
        <Link href="/catalog" className="hover:text-foreground font-medium">Katalog</Link>
        <ChevronRight className="h-4 w-4" />
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="text-xl sm:text-2xl font-bold text-foreground hover:underline underline-offset-2 text-left break-words"
        >
          {displayName}
        </button>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              {displayName}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="pt-2 space-y-2">
                {shop?.description ? (
                  <p className="text-foreground/90 whitespace-pre-wrap">{shop.description}</p>
                ) : (
                  <p className="text-muted-foreground">Maʼlumot kiritilmagan.</p>
                )}
                <p className="text-sm text-muted-foreground pt-2">
                  Siz ushbu doʻkon tovarlarini koʻrib chiqyapsiz. Barcha tovarlar uchun katalogda filterni tozalang.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
