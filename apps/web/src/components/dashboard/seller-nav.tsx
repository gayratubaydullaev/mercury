'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, ShoppingBag, BarChart3, Settings, ArrowLeft, Store, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const mainItems = [
  { href: '/seller', label: 'Bosh sahifa', icon: LayoutDashboard },
  { href: '/seller/products', label: 'Tovarlar', icon: Package },
  { href: '/seller/orders', label: 'Buyurtmalar', icon: ShoppingBag },
  { href: '/seller/reviews', label: 'Sharhlar', icon: MessageSquare },
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
}: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; pathname: string }) {
  const isActive = href === '/seller' ? pathname === '/seller' : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors shrink-0',
        'border-l-2 border-transparent md:border-l-0 md:border-l-[3px]',
        isActive
          ? 'bg-primary text-primary-foreground border-primary md:border-l-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  );
}

export function SellerNav() {
  const pathname = usePathname();

  return (
    <aside className="w-full md:w-60 shrink-0 border-b md:border-b-0 md:border-r border-border/60 bg-card flex flex-col">
      <div className="p-3 md:p-4 border-b border-border/60">
        <Link
          href="/seller"
          className="flex items-center gap-2 px-2 py-1.5 -mx-2 -my-1.5 rounded-lg hover:bg-muted/50 transition-colors md:mx-0 md:my-0"
        >
          <Store className="h-5 w-5 text-primary shrink-0" />
          <span className="font-semibold text-sm">Sotuvchi panel</span>
        </Link>
      </div>
      <nav className="p-3 md:p-4 flex md:flex-col gap-0.5 md:gap-0 overflow-x-auto md:overflow-visible flex-1">
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg shrink-0 mb-1"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Saytga qaytish</span>
        </Link>
        <div className="h-px bg-border/60 my-2 hidden md:block" aria-hidden />
        <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:block">
          Boshqaruv
        </p>
        <div className="flex flex-row gap-0.5 md:flex-col min-w-0 overflow-x-auto md:overflow-visible md:gap-0">
          {mainItems.map((item) => (
            <NavLink key={item.href} pathname={pathname} {...item} />
          ))}
        </div>
        <div className="h-px bg-border/60 my-2 hidden md:block" aria-hidden />
        <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:block">
          Sozlamalar
        </p>
        <div className="flex flex-row gap-0.5 md:flex-col min-w-0 overflow-x-auto md:overflow-visible md:gap-0">
          {secondaryItems.map((item) => (
            <NavLink key={item.href} pathname={pathname} {...item} />
          ))}
        </div>
      </nav>
    </aside>
  );
}
