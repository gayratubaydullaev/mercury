'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'myshopuz_cookie_notice_seen';

export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie xabarnoma"
      className={cn(
        'fixed bottom-20 left-0 right-0 z-50 md:bottom-4 md:left-4 md:right-auto md:max-w-md',
        'bg-card border border-border shadow-lg rounded-t-2xl md:rounded-2xl p-4 mx-2 md:mx-0',
        'animate-in slide-in-from-bottom duration-300'
      )}
    >
      <p className="text-sm text-muted-foreground mb-3">
        Sayt savatcha, tizimga kirish va xavfsizlik uchun <strong>cookie</strong> (kuki) foydalanadi.{' '}
        <Link href="/cookies" className="text-primary underline underline-offset-2 hover:no-underline">
          Batafsil
        </Link>
        . Davom etish orqali siz buni qabul qilasiz.
      </p>
      <Button variant="default" size="sm" onClick={accept} className="w-full md:w-auto">
        Tushundim
      </Button>
    </div>
  );
}
