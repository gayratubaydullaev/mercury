'use client';

import Link from 'next/link';
import { LogOut, ScanLine, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CashierChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/20">
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex min-w-0 items-center gap-2">
          <ScanLine className="h-6 w-6 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Kassa</p>
            <p className="truncate text-xs text-muted-foreground">Doʻkon kassasi · profil va chiqish</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" size="sm" className="min-h-9 gap-1.5" asChild>
            <Link href="/account">
              <UserRound className="h-4 w-4" aria-hidden />
              Profil
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="min-h-9" asChild>
            <Link href="/cashier/pos">POS</Link>
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
              window.location.href = '/auth/login?next=/cashier/pos';
            }}
          >
            <LogOut className="h-4 w-4" />
            Chiqish
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-6">{children}</main>
    </div>
  );
}
