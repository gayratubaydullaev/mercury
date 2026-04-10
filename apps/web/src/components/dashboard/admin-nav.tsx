'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, FolderTree, Package, ShoppingBag, Settings, BarChart3, ArrowLeft, Shield, Store, Banknote, ImageIcon, MessageSquare, Menu, X, Bell, FileCheck, FileEdit } from 'lucide-react';
import { DashboardNavFooter } from '@/components/dashboard/dashboard-nav-footer';
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
  { href: '/admin/seller-applications', label: 'Sotuvchi arizalari', icon: FileCheck, moderatorPermission: 'canApproveSellerApplications' },
  { href: '/admin/pending-shop-updates', label: 'Doʻkon oʻzgarishlari', icon: FileEdit, moderatorPermission: 'canApproveShopUpdates' },
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
        'flex items-center gap-3 rounded-r-lg px-3 py-2.5 text-sm transition-colors shrink-0 min-h-[44px] touch-manipulation md:min-h-0 md:py-2',
        'border-l-[3px] border-transparent',
        isActive
          ? 'border-primary bg-primary/[0.09] font-medium text-foreground dark:bg-primary/15'
          : 'text-muted-foreground hover:border-border hover:bg-muted/70 hover:text-foreground active:bg-muted/80'
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
          'fixed top-0 left-0 z-50 flex h-full w-[min(300px,100vw-2rem)] max-w-[85vw] flex-col border-r border-border/70 bg-card shadow-xl transition-transform duration-200 ease-out md:sticky md:top-0 md:z-30 md:h-auto md:min-h-dvh md:w-[260px] md:max-w-none md:shrink-0 md:shadow-none md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
        aria-label="Admin panel navigatsiyasi"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-muted/30 p-3 md:p-4">
          <Link
            href="/admin"
            className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 -mx-2 -my-1.5 transition-colors hover:bg-muted/50 md:mx-0 md:my-0"
            aria-label="Admin bosh sahifasi"
            onClick={() => setMobileOpen(false)}
          >
            <Shield className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <span className="truncate text-sm font-semibold">Admin panel</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <NotificationsBell basePath="/admin" />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-lg text-muted-foreground hover:bg-muted md:hidden"
              aria-label="Menyuni yopish"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain p-3 md:p-4" aria-label="Asosiy menyu">
          <NavContent pathname={pathname} onNavClick={() => setMobileOpen(false)} adminUser={adminUser} />
        </nav>
        <DashboardNavFooter />
      </aside>
    </>
  );
}
