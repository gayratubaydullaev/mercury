'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, ShoppingCart, Heart, User, ChevronRight, ArrowLeft, X } from 'lucide-react';
import { API_URL, cn } from '@/lib/utils';
import { getCartHeaders, saveCartSessionFromResponse } from '@/lib/cart-session';
import { apiFetch } from '@/lib/api';
import { getGuestFavoriteIds } from '@/lib/guest-favorites';
import { useAuth } from '@/contexts/auth-context';

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
        .then((r) => r.json())
        .then((data: { items?: { quantity?: number }[]; sessionId?: string } | null) => {
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

const navItems = [
  { href: '/', label: 'Bosh sahifa', icon: Home },
  { href: '/catalog', label: 'Katalog', icon: LayoutGrid },
  { href: '/cart', label: 'Savatcha', icon: ShoppingCart, badge: 'cart' as const },
  { href: '/favorites', label: 'Sevimlilar', icon: Heart, badge: 'favorites' as const },
  { href: '/account', hrefAlt: '/auth/login', label: 'Profil', icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const { isLoggedIn: hasUser } = useAuth();
  const cartCount = useCartCount();
  const favoritesCount = useFavoritesCount();
  const [mounted, setMounted] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!catalogOpen) return;
    apiFetch(`${API_URL}/categories?parentId=null`)
      .then((r) => r.json())
      .then((data: Category[]) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]));
  }, [catalogOpen]);

  const closeCatalog = () => {
    setCatalogOpen(false);
    setSelectedCategory(null);
  };

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-t border-border shadow-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around min-h-[48px] pt-2 pb-1 px-1">
          {navItems.map((item) => {
            const isCatalog = item.href === '/catalog' && item.label === 'Katalog';
            const href =
              !mounted ? item.hrefAlt ?? item.href : item.hrefAlt && !hasUser ? item.hrefAlt : item.href;
            const isActive =
              pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const Icon = item.icon;
            const badgeCount =
              item.badge === 'cart' ? cartCount : item.badge === 'favorites' ? favoritesCount : 0;

            if (isCatalog) {
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => setCatalogOpen(true)}
                  className={cn(
                    'relative flex flex-col items-center justify-center flex-1 min-h-[40px] rounded-xl transition-all duration-200 active:scale-95 gap-1',
                    isActive ? 'text-primary' : 'text-muted-foreground active:text-foreground'
                  )}
                  aria-label={item.label}
                >
                  <span className="relative flex items-center justify-center w-7 h-7">
                    <Icon className="h-6 w-6 shrink-0" />
                  </span>
                </button>
              );
            }

            return (
              <Link
                key={item.href}
                href={href}
                className={cn(
                  'relative flex flex-col items-center justify-center flex-1 min-h-[40px] rounded-xl transition-all duration-200 active:scale-95 gap-1',
                  isActive ? 'text-primary' : 'text-muted-foreground active:text-foreground'
                )}
                aria-label={item.label}
              >
                <span className="relative flex items-center justify-center w-7 h-7">
                  <Icon className="h-6 w-6 shrink-0" />
                  {badgeCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold ring-2 ring-background">
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Мобильная панель каталога: категории → подкатегории (оставляем снизу место под нижний навбар) */}
      {catalogOpen && (
        <div
          className="md:hidden fixed left-0 right-0 top-0 z-[55] bg-background flex flex-col border-b border-border shadow-lg"
          style={{
            bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div className="flex items-center gap-2 shrink-0 border-b border-border px-4 py-3">
            {selectedCategory ? (
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="p-2 -m-2 rounded-lg hover:bg-muted flex items-center gap-1 text-muted-foreground"
                aria-label="Orqaga"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : null}
            <h2 className="flex-1 font-semibold text-lg">
              {selectedCategory ? selectedCategory.name : 'Katalog'}
            </h2>
            <button
              type="button"
              onClick={closeCatalog}
              className="p-2 -m-2 rounded-lg hover:bg-muted"
              aria-label="Yopish"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
            style={{ paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 2rem))' }}
          >
            {!selectedCategory ? (
              <>
                <Link
                  href="/catalog"
                  onClick={closeCatalog}
                  className="flex items-center justify-between px-4 py-3.5 text-base font-medium border-b border-border active:bg-muted"
                >
                  Barcha mahsulotlar
                </Link>
                {categories.length === 0 && (
                  <div className="px-4 py-3 text-sm text-muted-foreground">Kategoriyalar yuklanmoqda...</div>
                )}
                {categories.map((cat) => {
                  const hasChildren = (cat.children?.length ?? 0) > 0;
                  if (hasChildren) {
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className="flex w-full items-center justify-between px-4 py-3.5 text-left text-base border-b border-border active:bg-muted"
                      >
                        <span>{cat.name}</span>
                        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                      </button>
                    );
                  }
                  return (
                    <Link
                      key={cat.id}
                      href={`/catalog?category=${encodeURIComponent(cat.slug)}`}
                      onClick={closeCatalog}
                      className="flex items-center justify-between px-4 py-3.5 text-base border-b border-border active:bg-muted"
                    >
                      {cat.name}
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    </Link>
                  );
                })}
              </>
            ) : (
              <div className="py-2">
                {(selectedCategory.children ?? []).length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">Ostkategoriyalar yoʻq</p>
                ) : (
                  (selectedCategory.children ?? []).map((sub) => (
                    <Link
                      key={sub.id}
                      href={`/catalog?category=${encodeURIComponent(sub.slug)}`}
                      onClick={closeCatalog}
                      className="flex items-center justify-between px-4 py-3.5 text-base border-b border-border active:bg-muted"
                    >
                      {sub.name}
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
