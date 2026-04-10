'use client';

import Link from 'next/link';
import { LogOut, ScanLine, Store, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** POS sahifasi: sotuvchi panelidagi yon menyu yoʻq, faqat yengil boshqaruv paneli */
export function SellerPosChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/20">
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-card/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
        <div className="flex min-w-0 items-center gap-2">
          <ScanLine className="h-6 w-6 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">POS kassa</p>
            <p className="truncate text-xs text-muted-foreground">Toʻliq ekran · sotuvchi paneliga qaytish</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" size="sm" className="min-h-9 gap-1.5" asChild>
            <Link href="/seller">
              <Store className="h-4 w-4" aria-hidden />
              Kabinet
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="min-h-9 gap-1.5" asChild>
            <Link href="/account">
              <UserRound className="h-4 w-4" aria-hidden />
              Profil
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="min-h-9" asChild>
            <Link href="/">Sayt</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground"
            onClick={() => {
              localStorage.removeItem('accessToken');
              window.dispatchEvent(new Event('auth-change'));
              window.location.href = '/auth/login?next=/seller/pos';
            }}
          >
            <LogOut className="h-4 w-4" />
            Chiqish
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-5">
        {children}
      </main>
    </div>
  );
}
