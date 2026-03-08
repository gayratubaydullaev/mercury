'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { API_URL } from '@/lib/utils';

const STORAGE_KEY = 'accessToken';

type AuthContextValue = {
  token: string | null;
  isLoggedIn: boolean;
  /** false until localStorage has been read (client-side) — use to avoid redirecting before we know the token */
  isReady: boolean;
  setToken: (token: string | null) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTokenState(readStoredToken());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined' || !API_URL) return;
    const stored = readStoredToken();
    if (stored) return;
    fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then((r) => {
        if (!r.ok) return;
        return r.json() as Promise<{ accessToken?: string }>;
      })
      .then((data) => {
        if (data?.accessToken) {
          localStorage.setItem(STORAGE_KEY, data.accessToken);
          setTokenState(data.accessToken);
          window.dispatchEvent(new Event('auth-change'));
        }
      })
      .catch(() => {});
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const onAuthChange = () => setTokenState(readStoredToken());
    window.addEventListener('auth-change', onAuthChange);
    return () => window.removeEventListener('auth-change', onAuthChange);
  }, [mounted]);

  const setToken = useCallback((value: string | null) => {
    if (typeof window !== 'undefined') {
      if (value == null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, value);
    }
    setTokenState(value);
    window.dispatchEvent(new Event('auth-change'));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
  }, [setToken]);

  const value: AuthContextValue = {
    token: mounted ? token : null,
    isLoggedIn: !!token,
    isReady: mounted,
    setToken,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      token: null,
      isLoggedIn: false,
      isReady: false,
      setToken: () => {},
      logout: () => {},
    };
  }
  return ctx;
}
