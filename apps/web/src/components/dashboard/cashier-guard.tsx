'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';

export function CashierGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, isReady } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isReady) return;
    if (!token) {
      router.replace('/auth/login?next=/cashier/pos');
      return;
    }
    apiFetch(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((user: { role?: string }) => {
        if (user?.role !== 'CASHIER') {
          router.replace('/');
          return;
        }
        setAllowed(true);
      })
      .catch(() => router.replace('/auth/login?next=/cashier/pos'));
  }, [router, token, isReady]);

  if (allowed !== true) return <Skeleton className="h-screen w-full" />;
  return <>{children}</>;
}
