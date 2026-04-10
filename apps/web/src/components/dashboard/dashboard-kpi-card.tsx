import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type DashboardKpiCardProps = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'warning';
};

export function DashboardKpiCard({ label, value, hint, href, icon: Icon, variant = 'default' }: DashboardKpiCardProps) {
  const inner = (
    <div
      className={cn(
        'rounded-xl border bg-card p-4 shadow-sm ring-1 ring-black/[0.03] transition-colors dark:ring-white/[0.04]',
        'border-border/70',
        href && 'hover:border-primary/30 hover:bg-muted/15 cursor-pointer',
        variant === 'warning' && 'border-amber-500/35 bg-amber-500/[0.06] dark:bg-amber-500/[0.08]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">{value}</p>
          {hint ? <p className="text-xs text-muted-foreground leading-snug">{hint}</p> : null}
        </div>
        {Icon ? (
          <div className="rounded-lg border border-border/50 bg-muted/40 p-2 text-muted-foreground">
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
          </div>
        ) : null}
      </div>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
        {inner}
      </Link>
    );
  }
  return inner;
}
