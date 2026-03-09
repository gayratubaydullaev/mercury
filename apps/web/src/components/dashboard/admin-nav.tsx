'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, FolderTree, Package, ShoppingBag, Settings, BarChart3, ArrowLeft, Shield, Store, Banknote, ImageIcon, MessageSquare, Menu, X, Bell } from 'lucide-react';
import { cn, API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { NotificationsBell } from './notifications-bell';

type ModeratorPermissionKey = 'canModerateProducts' | 'canModerateReviews' | 'canApproveSellerApplications' | 'canApproveShopUpdates';

const mainItems: { href: string; label: string; icon: typeof LayoutDashboard; moderatorPermission?: ModeratorPermissionKey }[] = [
  { href: '/admin', label: 'Bosh sahifa', icon: LayoutDashboard },
  { href: '/admin/notifications', label: 'Bildirishnomalar', icon: Bell },
  { href: '/admin/users', label: 'Foydalanuvchilar', icon: Users },
  { href: '/admin/sellers', label: 'Sotuvchilar', icon: Store },
  { href: '/admin/orders', label: 'Buyurtmalar', icon: ShoppingBag },
  { href: '/admin/products', label: 'Tovarlar (moderatsiya)', icon: Package, moderatorPermission: 'canModerateProducts' },
  { href: '/admin/reviews', label: 'Sharhlar', icon: MessageSquare, moderatorPermission: 'canModerateReviews' },
  { href: '/admin/stats', label: 'Analitika', icon: BarChart3 },
  { href: '/admin/payouts', label: "Komissiya hisobi", icon: Banknote },
];
const secondaryItems: { href: string; label: string; icon: typeof FolderTree; adminOnly?: boolean }[] = [
  { href: '/admin/categories', label: 'Toifalar', icon: FolderTree, adminOnly: true },
  { href: '/admin/banners', label: 'Bannerlar', icon: ImageIcon, adminOnly: true },
  { href: '/admin/settings', label: 'Platforma sozlamalari', icon: Settings, adminOnly: true },
];

function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pathname: string;
  onClick?: () => void;
}) {
  const isActive = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
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
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  );
}

function canShowMainItem(
  item: (typeof mainItems)[number],
  role: string | null,
  permissions: Record<string, boolean> | null | undefined
): boolean {
  if (role === 'ADMIN') return true;
  if (role !== 'ADMIN_MODERATOR') return true;
  if (!item.moderatorPermission) return true;
  return permissions?.[item.moderatorPermission] !== false;
}

function NavContent({
  pathname,
  onNavClick,
  adminUser,
}: {
  pathname: string;
  onNavClick?: () => void;
  adminUser: { role: string; moderatorPermissions?: Record<string, boolean> | null } | null;
}) {
  const role = adminUser?.role ?? null;
  const permissions = adminUser?.moderatorPermissions;
  const filteredMain = mainItems.filter((item) => canShowMainItem(item, role, permissions));
  const filteredSecondary = secondaryItems.filter((item) => !item.adminOnly || role === 'ADMIN');

  return (
    <>
      <Link
        href="/"
        onClick={onNavClick}
        className="flex items-center gap-3 px-3 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg shrink-0 min-h-[44px] touch-manipulation mb-1"
      >
        <ArrowLeft className="h-5 w-5 md:h-4 md:w-4 shrink-0" aria-hidden />
        <span>Saytga qaytish</span>
      </Link>
      <div className="h-px bg-border/60 my-2" aria-hidden />
      <p id="nav-main-label" className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Boshqaruv</p>
      <div className="flex flex-col gap-0.5" aria-labelledby="nav-main-label">
        {filteredMain.map((item) => (
          <NavLink key={item.href} pathname={pathname} href={item.href} label={item.label} icon={item.icon} onClick={onNavClick} />
        ))}
      </div>
      {filteredSecondary.length > 0 && (
        <>
          <div className="h-px bg-border/60 my-2" aria-hidden />
          <p id="nav-secondary-label" className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Katalog va sozlamalar</p>
          <div className="flex flex-col gap-0.5" aria-labelledby="nav-secondary-label">
            {filteredSecondary.map((item) => (
              <NavLink key={item.href} pathname={pathname} href={item.href} label={item.label} icon={item.icon} onClick={onNavClick} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function AdminNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { token } = useAuth();
  const [adminUser, setAdminUser] = useState<{ role: string; moderatorPermissions?: Record<string, boolean> | null } | null>(null);

  useEffect(() => {
    if (!token || !API_URL) return;
    apiFetch(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((me: { role?: string; moderatorPermissions?: Record<string, boolean> | null }) =>
        me ? { role: me.role ?? '', moderatorPermissions: me.moderatorPermissions ?? null } : null
      )
      .then(setAdminUser)
      .catch(() => setAdminUser(null));
  }, [token]);

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
        <Link href="/admin" className="flex items-center gap-2 min-h-[44px] items-center" onClick={() => setMobileOpen(false)}>
          <Shield className="h-5 w-5 text-primary shrink-0" />
          <span className="font-semibold text-sm">Admin panel</span>
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

      {/* Выдвижная панель меню (мобильная) */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-[min(300px,100vw-2rem)] max-w-[85vw] bg-card border-r border-border/60 shadow-xl flex flex-col transition-transform duration-200 ease-out md:translate-x-0 md:shadow-none md:static md:h-auto md:w-60 md:max-w-none',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
        aria-label="Admin panel navigatsiyasi"
      >
        <div className="p-3 md:p-4 border-b border-border/60 flex items-center justify-between md:justify-start">
          <Link
            href="/admin"
            className="flex items-center gap-2 px-2 py-1.5 -mx-2 -my-1.5 rounded-lg hover:bg-muted/50 transition-colors md:mx-0 md:my-0 min-w-0"
            aria-label="Admin bosh sahifasi"
            onClick={() => setMobileOpen(false)}
          >
            <Shield className="h-5 w-5 text-primary shrink-0" aria-hidden />
            <span className="font-semibold text-sm truncate">Admin panel</span>
          </Link>
          <NotificationsBell basePath="/admin" />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="md:hidden flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-muted text-muted-foreground touch-manipulation"
            aria-label="Menyuni yopish"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="p-3 md:p-4 flex flex-col gap-0.5 overflow-y-auto flex-1 overscroll-contain" aria-label="Asosiy menyu">
          <NavContent pathname={pathname} onNavClick={() => setMobileOpen(false)} adminUser={adminUser} />
        </nav>
      </aside>
    </>
  );
}
