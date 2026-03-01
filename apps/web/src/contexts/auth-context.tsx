'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'accessToken';

type AuthContextValue = {
  token: string | null;
  isLoggedIn: boolean;
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
      setToken: () => {},
      logout: () => {},
    };
  }
  return ctx;
}
