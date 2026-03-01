'use client';

import { useEffect } from 'react';
import { getCsrfToken } from '@/lib/api';

/** Prefetches CSRF token on app load so mutations have the cookie set. */
export function CsrfPrefetch() {
  useEffect(() => {
    getCsrfToken();
  }, []);
  return null;
}
