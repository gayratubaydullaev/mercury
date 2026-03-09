'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, ShoppingBag, BarChart3, Settings, ArrowLeft, Store, MessageCircle, Plus, ExternalLink, Star, Menu, X, Bell } from 'lucide-react';
import { cn, API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { NotificationsBell } from './notifications-bell';

const mainItems = [
  { href: '/seller', label: 'Bosh sahifa', icon: LayoutDashboard },
  { href: '/seller/notifications', label: 'Bildirishnomalar', icon: Bell },
  { href: '/seller/products', label: 'Tovarlar', icon: Package },
  { href: '/seller/orders', label: 'Buyurtmalar', icon: ShoppingBag, badgeKey: 'pendingOrdersCount' as const },
  { href: '/seller/reviews', label: 'Sharhlar', icon: Star },
  { href: '/seller/stats', label: 'Statistika', icon: BarChart3 },
];
const secondaryItems = [
  { href: '/seller/settings', label: 'Doʻkon sozlamalari', icon: Settings },
];

function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
  badge,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pathname: string;
  badge?: number;
  onClick?: () => void;
}) {
  const isActive = href === '/seller' ? pathname === '/seller' : pathname.startsWith(href);
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      aria-label={label}
      className={cn(
        'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors shrink-0 min-h-[44px] touch-manipulation',
        'border-l-2 border-transparent md:border-l-0 md:border-l-[3px]',
        isActive
          ? 'bg-primary text-primary-foreground border-primary md:border-l-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/80'
      )}
    >
      <Icon className="h-5 w-5 shrink-0 md:h-4 md:w-4" aria-hidden />
      <span className="whitespace-nowrap flex-1 min-w-0 truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span className="shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

function NavContent({
  pathname,
  pendingCount,
  shopSlug,
  onNavClick,
}: {
  pathname: string;
  pendingCount: number;
  shopSlug: string | null;
  onNavClick?: () => void;
}) {
  return (
    <>
      <Link
        href="/"
        onClick={onNavClick}
        className="flex items-center gap-3 px-3 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg shrink-0 min-h-[44px] touch-manipulation mb-1"
        aria-label="Saytga qaytish"
      >
        <ArrowLeft className="h-5 w-5 md:h-4 md:w-4 shrink-0" aria-hidden />
        <span>Saytga qaytish</span>
      </Link>
      {shopSlug && (
        <Link
          href={`/catalog?shop=${encodeURIComponent(shopSlug)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onNavClick}
          className="flex items-center gap-3 px-3 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg shrink-0 min-h-[44px] touch-manipulation"
          aria-label="Doʻkonimni koʻrish"
        >
          <ExternalLink className="h-5 w-5 md:h-4 md:w-4 shrink-0" aria-hidden />
          <span>Doʻkonimni koʻrish</span>
        </Link>
      )}
      <div className="h-px bg-border/60 my-2" aria-hidden />
      <p id="seller-nav-main-label" className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Boshqaruv</p>
      <div className="flex flex-col gap-0.5" aria-labelledby="seller-nav-main-label">
        {mainItems.map((item) => (
          <NavLink
            key={item.href}
            pathname={pathname}
            href={item.href}
            label={item.label}
            icon={item.icon}
            badge={item.badgeKey === 'pendingOrdersCount' ? pendingCount : undefined}
            onClick={onNavClick}
          />
        ))}
      </div>
      <div className="h-px bg-border/60 my-2" aria-hidden />
      <Link
        href="/chat?as=seller"
        onClick={onNavClick}
        aria-current={pathname === '/chat' ? 'page' : undefined}
        className={cn(
          'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors shrink-0 min-h-[44px] touch-manipulation',
          pathname === '/chat' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
        aria-label="Xabarlar"
      >
        <MessageCircle className="h-5 w-5 md:h-4 md:w-4 shrink-0" aria-hidden />
        <span>Xabarlar</span>
      </Link>
      <div className="h-px bg-border/60 my-2" aria-hidden />
      <p id="seller-nav-settings-label" className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sozlamalar</p>
      <div className="flex flex-col gap-0.5" aria-labelledby="seller-nav-settings-label">
        {secondaryItems.map((item) => (
          <NavLink key={item.href} pathname={pathname} {...item} onClick={onNavClick} />
        ))}
      </div>
    </>
  );
}

export function SellerNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [stats, setStats] = useState<{ pendingOrdersCount?: number; shopSlug?: string | null } | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  useEffect(() => {
    if (!token) return;
    apiFetch(`${API_URL}/seller/stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => setStats(null));
  }, [token]);

  const pendingCount = stats?.pendingOrdersCount ?? 0;
  const shopSlug = stats?.shopSlug ?? null;

  return (
    <>
      {/* Мобильная шапка: кнопка меню + заголовок */}
      <div
        className="md:hidden sticky top-0 z-40 flex items-center justify-between gap-2 px-4 py-3 bg-card border-b border-border/60 shadow-sm"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] -ml-2 rounded-lg hover:bg-muted active:bg-muted/80 touch-manipulation"
          aria-label="Menyuni ochish"
        >
          <Menu className="h-6 w-6 text-foreground" />
        </button>
        <Link href="/seller" className="flex items-center gap-2 min-h-[44px] items-center" onClick={() => setMobileOpen(false)}>
          <Store className="h-5 w-5 text-primary shrink-0" aria-hidden />
          <span className="font-semibold text-sm">Sotuvchi panel</span>
        </Link>
        <div className="min-w-[44px]" aria-hidden />
      </div>

      {/* Оверлей при открытом мобильном меню */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Menyuni yopish"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Выдвижная панель меню (мобильная) / боковая панель (десктоп) */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-[min(300px,100vw-2rem)] max-w-[85vw] bg-card border-r border-border/60 shadow-xl flex flex-col transition-transform duration-200 ease-out md:translate-x-0 md:shadow-none md:static md:h-auto md:w-60 md:max-w-none',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
        aria-label="Sotuvchi panel navigatsiyasi"
      >
        <div className="p-3 md:p-4 border-b border-border/60 flex flex-row flex-wrap items-center justify-between md:flex-col md:items-stretch md:justify-start gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/seller"
              className="flex items-center gap-2 px-2 py-1.5 -mx-2 -my-1.5 rounded-lg hover:bg-muted/50 transition-colors md:mx-0 md:my-0 min-h-[44px] md:min-h-0 items-center"
              aria-label="Sotuvchi bosh sahifasi"
              onClick={() => setMobileOpen(false)}
            >
              <Store className="h-5 w-5 text-primary shrink-0" aria-hidden />
              <span className="font-semibold text-sm">Sotuvchi panel</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <NotificationsBell basePath="/seller" />
            <Link
              href="/seller/products/new"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors min-h-[44px] md:min-h-[40px] touch-manipulation"
              aria-label="Yangi tovar qoʻshish"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>Yangi tovar</span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="md:hidden flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-muted text-muted-foreground touch-manipulation"
              aria-label="Menyuni yopish"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <nav className="p-3 md:p-4 flex flex-col gap-0.5 overflow-y-auto flex-1 overscroll-contain" aria-label="Asosiy menyu">
          <NavContent
            pathname={pathname}
            pendingCount={pendingCount}
            shopSlug={shopSlug}
            onNavClick={() => setMobileOpen(false)}
          />
        </nav>
      </aside>
    </>
  );
}
