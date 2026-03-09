'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { ShoppingCart, User, Sun, Moon, Heart, LayoutGrid, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTheme } from 'next-themes';
import { cn, API_URL, formatPrice, transliterateCyrillicToLatin, isTokenExpired } from '@/lib/utils';
import { getCartHeaders, saveCartSessionFromResponse } from '@/lib/cart-session';
import { apiFetch } from '@/lib/api';
import { getGuestFavoriteIds } from '@/lib/guest-favorites';
import { useAuth } from '@/contexts/auth-context';
import { usePublicSettings } from '@/contexts/public-settings-context';
import { toast } from 'sonner';

const RECENT_SEARCHES_KEY = 'myshop-recent-searches';
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function addRecentSearch(query: string) {
  const q = query.trim();
  if (!q) return;
  const list = getRecentSearches().filter((s) => s !== q);
  list.unshift(q);
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    // ignore quota or storage errors
  }
}

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  children?: Category[];
}

function useCartCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    function fetchCart(retry = false) {
      apiFetch(`${API_URL}/cart`, { headers: getCartHeaders() })
        .then((r) => {
          if (!r.ok) {
            if (r.status === 502 && !retry) toast.error('Tarmoq xatosi. Qayta urinib koʻring.');
            setCount(0);
            if (!retry) setTimeout(() => fetchCart(true), 2000);
            return null;
          }
          return r.json();
        })
        .then((data: { items?: { quantity?: number }[]; sessionId?: string } | null) => {
          if (data == null) return;
          saveCartSessionFromResponse(data);
          const items = data?.items ?? [];
          setCount(items.reduce((s, i) => s + (i.quantity ?? 0), 0));
        })
        .catch(() => {
          setCount(0);
          if (!retry) setTimeout(() => fetchCart(true), 2000);
        });
    }
    fetchCart();
    const onRefresh = () => fetchCart(true);
    window.addEventListener('focus', onRefresh);
    window.addEventListener('cart-updated', onRefresh);
    return () => {
      window.removeEventListener('focus', onRefresh);
      window.removeEventListener('cart-updated', onRefresh);
    };
  }, []);
  return count;
}

function useFavoritesCount() {
  const { token, setToken } = useAuth();
  const [count, setCount] = useState(0);
  useEffect(() => {
    function updateGuest() {
      setCount(getGuestFavoriteIds().length);
    }
    function fetchFav() {
      if (!token) {
        updateGuest();
        return;
      }
      if (isTokenExpired(token)) {
        setToken(null);
        updateGuest();
        return;
      }
      apiFetch(`${API_URL}/favorites`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => {
          if (r.status === 401) {
            setToken(null);
            updateGuest();
            return null;
          }
          return r.json();
        })
        .then((data: unknown[] | null) => {
          if (data != null) setCount(Array.isArray(data) ? data.length : 0);
        })
        .catch(() => setCount(0));
    }
    if (!token) {
      updateGuest();
      window.addEventListener('guest-favorites-changed', updateGuest);
      return () => window.removeEventListener('guest-favorites-changed', updateGuest);
    }
    fetchFav();
    window.addEventListener('focus', fetchFav);
    return () => window.removeEventListener('focus', fetchFav);
  }, [token, setToken]);
  return count;
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<Category | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [, setMounted] = useState(false);
  const catalogRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLFormElement>(null);
  const { isLoggedIn: hasUser } = useAuth();
  const cartCount = useCartCount();
  const favoritesCount = useFavoritesCount();

  const [searchSuggestions, setSearchSuggestions] = useState<{ id: string; title: string; slug: string; price: string; images: { url: string }[] }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function fetchCategories(retry = false) {
      apiFetch(`${API_URL}/categories?parentId=null`)
        .then((r) => r.json())
        .then((data: Category[]) => setCategories(Array.isArray(data) ? data : []))
        .catch(() => {
          setCategories([]);
          if (!retry) setTimeout(() => fetchCategories(true), 2000);
        });
    }
    fetchCategories();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (catalogRef.current && !catalogRef.current.contains(e.target as Node)) {
        setCatalogOpen(false);
        setHoveredCategory(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Закрывать выпадающий каталог при смене страницы
  useEffect(() => {
    setCatalogOpen(false);
    setHoveredCategory(null);
  }, [pathname]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      addRecentSearch(q);
      const forApi = transliterateCyrillicToLatin(q);
      router.push(`/catalog?search=${encodeURIComponent(forApi)}`);
    } else {
      router.push('/catalog');
    }
    setSearchOpen(false);
  };

  const openCatalogWithSearch = (q: string) => {
    const trimmed = q.trim();
    if (trimmed) {
      addRecentSearch(trimmed);
      const forApi = transliterateCyrillicToLatin(trimmed);
      router.push(`/catalog?search=${encodeURIComponent(forApi)}`);
    } else {
      router.push('/catalog');
    }
    setSearchOpen(false);
    setSearchQuery('');
  };

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchSuggestions([]);
      return;
    }
    const searchForApi = transliterateCyrillicToLatin(q);
    const t = setTimeout(() => {
      setSearchLoading(true);
      fetch(`${API_URL}/products?search=${encodeURIComponent(searchForApi)}&limit=6&sortBy=relevance`)
        .then((r) => r.json())
        .then((data: { data?: { id: string; title: string; slug: string; price: string; images: { url: string }[] }[] }) => {
          setSearchSuggestions(Array.isArray(data?.data) ? data.data : []);
          setSearchOpen(true);
          setHighlightedIndex(-1);
        })
        .catch(() => setSearchSuggestions([]))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const suggestionCount = searchSuggestions.length;
  const totalOptions = suggestionCount + (searchQuery.trim() && suggestionCount > 0 ? 1 : 0);
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!searchOpen) {
        if (e.key === 'Escape') (e.target as HTMLInputElement).blur();
        return;
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setHighlightedIndex(-1);
        e.preventDefault();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((i) => (i < totalOptions - 1 ? i + 1 : i));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((i) => (i > -1 ? i - 1 : -1));
        return;
      }
      if (e.key === 'Enter' && highlightedIndex >= 0) {
        e.preventDefault();
        if (highlightedIndex < suggestionCount) {
          const p = searchSuggestions[highlightedIndex];
          if (p) {
            router.push(`/product/${p.id}`);
            setSearchOpen(false);
          }
        } else if (searchQuery.trim()) {
          openCatalogWithSearch(searchQuery);
        }
      }
    },
    [searchOpen, highlightedIndex, totalOptions, suggestionCount, searchSuggestions, searchQuery, router],
  );

  const { siteName } = usePublicSettings();
  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full pt-3 pb-2 bg-background/80 backdrop-blur-md border-b md:border-b-0 md:bg-transparent',
        pathname.startsWith('/product/') && 'hidden md:block'
      )}
    >
      <div className="w-full px-0 sm:px-3 md:px-6">
        <div className="rounded-3xl border border-border bg-card/80 backdrop-blur-xl shadow-sm px-3 md:px-6">
          {/* Одна строка: логотип + каталог + поиск; на десктопе ещё иконки */}
          <div className="flex items-center gap-2 md:gap-6 md:h-20 py-2 md:py-0">
            {/* Logo — только десктоп */}
            <Link href="/" target="_self" className="hidden md:flex shrink-0 font-bold text-xl text-primary" aria-label={`${siteName} — bosh sahifa`}>
              {siteName}
            </Link>

            {/* Catalog — только десктоп */}
            <div className="relative shrink-0 hidden md:block" ref={catalogRef}>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'gap-1.5 md:gap-2 font-medium h-9 md:h-12 rounded-full md:text-base',
                  pathname.startsWith('/catalog') ? 'text-primary bg-primary/10' : 'text-foreground'
                )}
                onClick={() => {
                  setCatalogOpen((v) => !v);
                  if (catalogOpen) setHoveredCategory(null);
                }}
                aria-expanded={catalogOpen}
                aria-haspopup="true"
              >
                <LayoutGrid className="h-5 w-5 md:h-7 md:w-7 shrink-0" />
                <span className="hidden sm:inline">Katalog</span>
                <svg className={cn('h-4 w-4 transition-transform shrink-0', catalogOpen && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </Button>
              {catalogOpen && (
                <div className="fixed left-0 top-24 z-50 flex w-[min(560px,100vw-2rem)] max-w-full max-h-[calc(100vh-6rem)] rounded-r-xl border border-l-0 border-border bg-card shadow-xl overflow-hidden">
                  {/* Левая колонка — категории (скролл при большом списке) */}
                  <div className="w-72 shrink-0 border-r border-border bg-card py-2 overflow-y-auto max-h-[calc(100vh-6rem)] min-h-0">
                    <Link
                      href="/catalog"
                      className="flex items-center gap-2 rounded-lg mx-1.5 px-3 py-2 text-sm hover:bg-accent font-medium"
                      onClick={() => { setCatalogOpen(false); setHoveredCategory(null); }}
                    >
                      Barcha mahsulotlar
                    </Link>
                    {categories.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Kategoriyalar yuklanmoqda...</div>
                    )}
                    {categories.map((cat) => (
                      <div
                        key={cat.id}
                        role="button"
                        tabIndex={0}
                        className={cn(
                          'flex items-center justify-between rounded-lg mx-1.5 px-3 py-2 text-sm cursor-pointer transition-colors',
                          hoveredCategory?.id === cat.id ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/80'
                        )}
                        onMouseEnter={() => setHoveredCategory(cat)}
                        onFocus={() => setHoveredCategory(cat)}
                      >
                        <span>{cat.name}</span>
                        {(cat.children?.length ?? 0) > 0 && (
                          <svg className="h-4 w-4 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Правая колонка — подкатегории при наведении (скролл при большом списке) */}
                  <div className="flex-1 min-w-[200px] min-h-0 py-3 px-2 bg-muted/50 overflow-y-auto max-h-[calc(100vh-6rem)]">
                    {hoveredCategory ? (
                      (hoveredCategory.children?.length ?? 0) > 0 ? (
                        <div className="grid gap-0.5">
                          <p className="text-xs font-semibold text-muted-foreground px-2 mb-1.5 uppercase tracking-wide">
                            {hoveredCategory.name}
                          </p>
                          {(hoveredCategory.children ?? []).map((sub) => (
                            <Link
                              key={sub.id}
                              href={`/catalog?category=${encodeURIComponent(sub.slug)}`}
                              className="rounded-lg px-3 py-2 text-sm hover:bg-background hover:shadow-sm transition-colors block"
                              onClick={() => { setCatalogOpen(false); setHoveredCategory(null); }}
                            >
                              {sub.name}
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground px-3">Ostkategoriyalar yoʻq</p>
                      )
                    ) : (
                      <p className="text-sm text-muted-foreground px-3">Kategoriyani tanlang</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Интерактивный поиск: подсказки при вводе, недавние запросы, клавиатурная навигация */}
            <form onSubmit={handleSearch} className="flex-1 min-w-0 flex w-full md:w-auto" ref={searchContainerRef}>
              <div className="relative w-full min-w-0">
                <Search className="absolute left-2.5 md:left-3 top-1/2 h-4 w-4 md:h-5 md:w-5 -translate-y-1/2 text-muted-foreground shrink-0 pointer-events-none z-10" />
                {searchLoading && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 md:h-5 md:w-5 -translate-y-1/2 text-muted-foreground animate-spin pointer-events-none z-10" />
                )}
                <Input
                  type="search"
                  placeholder="Mahsulotlar qidirish..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (searchQuery.trim().length >= 2 && searchSuggestions.length > 0) setSearchOpen(true);
                    else if (!searchQuery.trim() && getRecentSearches().length > 0) setSearchOpen(true);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  autoComplete="off"
                  className="pl-9 pr-9 h-9 md:h-12 w-full bg-muted/50 border-muted-foreground/20 text-sm md:text-base"
                />
                {searchOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden max-h-[min(70vh,400px)] overflow-y-auto">
                    {searchQuery.trim() ? (
                      <>
                        {searchSuggestions.length === 0 && !searchLoading && (
                          <div className="p-4 text-center">
                            <p className="text-sm text-muted-foreground mb-2">Natija topilmadi.</p>
                            <button
                              type="button"
                              onClick={() => openCatalogWithSearch(searchQuery)}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              Barcha mahsulotlarni koʻrish →
                            </button>
                          </div>
                        )}
                        {searchSuggestions.map((p, i) => (
                          <Link
                            key={p.id}
                            href={`/product/${p.id}`}
                            onClick={() => setSearchOpen(false)}
                            className={cn(
                              'flex items-center gap-3 p-3 text-left hover:bg-muted/80 transition-colors border-b border-border/50 last:border-0',
                              highlightedIndex === i && 'bg-muted/80'
                            )}
                          >
                            <div className="relative w-12 h-12 rounded-lg bg-muted shrink-0 overflow-hidden">
                              {p.images?.[0]?.url && (
                                <Image src={p.images[0].url} alt="" fill className="object-cover" sizes="48px" unoptimized />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-foreground truncate text-sm">{p.title}</p>
                              <p className="text-muted-foreground text-xs">{formatPrice(Number(p.price))} soʻm</p>
                            </div>
                          </Link>
                        ))}
                        {searchQuery.trim() && searchSuggestions.length > 0 && (
                          <button
                            type="button"
                            onClick={() => openCatalogWithSearch(searchQuery)}
                            className={cn(
                              'w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary hover:bg-muted/80 transition-colors border-t border-border',
                              highlightedIndex === suggestionCount && 'bg-muted/80'
                            )}
                          >
                            Barcha natijalar: «{searchQuery.trim()}» — Enter
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        {(() => {
                          const recent = getRecentSearches();
                          return recent.length > 0 ? (
                            <div className="p-2 border-b border-border">
                              <p className="text-xs text-muted-foreground px-2 py-1">Soʻnggi qidiruvlar</p>
                              {recent.map((r) => (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() => openCatalogWithSearch(r)}
                                  className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-muted/80 transition-colors"
                                >
                                  {r}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="p-4 text-sm text-muted-foreground text-center">
                              Kamida 2 ta belgi yozing — mahsulotlar roʻyxati paydo boʻladi.
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}
              </div>
              <Button type="submit" size="sm" className="ml-1.5 shrink-0 h-9 md:h-12 px-5 hidden md:flex md:text-base">
                Qidirish
              </Button>
            </form>

            {/* Только десктоп: корзина, избранное, профиль, тема */}
            <nav className="hidden md:flex items-center gap-3 shrink-0">
              <Button variant="ghost" size="icon" className="h-14 w-14 relative rounded-full hover:bg-muted/60" asChild>
                <Link href="/cart" title="Savatcha">
                  <ShoppingCart className="h-7 w-7" />
                  {cartCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[22px] h-[22px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold px-1 ring-2 ring-white">
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                </Link>
              </Button>
              <Button variant="ghost" size="icon" className="h-14 w-14 relative rounded-full hover:bg-muted/60" asChild>
                <Link href="/favorites" title="Sevimlilar">
                  <Heart className="h-7 w-7" />
                  {favoritesCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[22px] h-[22px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold px-1 ring-2 ring-white">
                      {favoritesCount > 99 ? '99+' : favoritesCount}
                    </span>
                  )}
                </Link>
              </Button>
              {hasUser ? (
                <Button variant="ghost" size="icon" className="h-14 w-14 rounded-full hover:bg-muted/60" asChild>
                  <Link href="/account" title="Profil">
                    <User className="h-7 w-7" />
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="rounded-full px-6 h-11 text-base font-medium" asChild>
                  <Link href="/auth/login">Kirish</Link>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="relative h-14 w-14 rounded-full hover:bg-muted/60"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                title="Tema"
              >
                <Sun className="h-7 w-7 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-7 w-7 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Tema</span>
              </Button>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
