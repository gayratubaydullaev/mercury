'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { API_URL } from '@/lib/utils';
import { getGuestFavoriteIds, mergeGuestFavoritesToAccount } from '@/lib/guest-favorites';

/** When user logs in, merge guest favorites (localStorage) into their account, then clear guest list. */
export function MergeGuestFavoritesOnLogin() {
  const { token } = useAuth();
  const didMergeRef = useRef(false);

  useEffect(() => {
    if (!token) {
      didMergeRef.current = false;
      return;
    }
    if (didMergeRef.current) return;
    const guestIds = getGuestFavoriteIds();
    if (guestIds.length === 0) return;
    didMergeRef.current = true;
    mergeGuestFavoritesToAccount(API_URL, token).catch(() => {});
  }, [token]);

  return null;
}
