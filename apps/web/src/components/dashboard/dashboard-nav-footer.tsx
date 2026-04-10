'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { LogOut, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';

export function DashboardNavFooter() {
  const { logout } = useAuth();
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && (resolvedTheme === 'dark' || theme === 'dark');

  return (
    <div className="mt-auto shrink-0 space-y-2 border-t border-border/70 bg-muted/25 p-3 md:p-4">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2 font-normal"
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        aria-label={isDark ? 'Yorugʻ rejim' : 'Qorongʻu rejim'}
        disabled={!mounted}
      >
        {mounted ? (
          isDark ? (
            <>
              <Sun className="h-4 w-4 shrink-0" aria-hidden />
              Yorugʻ rejim
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 shrink-0" aria-hidden />
              Qorongʻu rejim
            </>
          )
        ) : (
          <>
            <Sun className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
            Mavzu
          </>
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 font-normal text-muted-foreground hover:text-destructive"
        onClick={() => {
          logout();
          router.push('/');
        }}
      >
        <LogOut className="h-4 w-4 shrink-0" aria-hidden />
        Chiqish
      </Button>
    </div>
  );
}
