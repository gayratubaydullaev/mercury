import type { ReactNode } from 'react';

type DashboardPageHeaderProps = {
  title: string;
  description?: string;
  /** Qisqa yuqori sarlavha (masalan: «Platforma» yoki «Sotuvchi kabineti») */
  eyebrow?: string;
  /** Ikkilamchi qator (masalan, doʻkon nomi) */
  subtitle?: string;
  /** POS kabi tezkor ekranlar — kamroq vertikal joy */
  compact?: boolean;
  children?: ReactNode;
};

export function DashboardPageHeader({
  title,
  description,
  eyebrow = 'Boshqaruv paneli',
  subtitle,
  compact = false,
  children,
}: DashboardPageHeaderProps) {
  return (
    <header
      className={
        compact
          ? 'mb-4 flex flex-col gap-3 border-b border-border/50 pb-4 sm:mb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-5 sm:pb-5'
          : 'mb-6 flex flex-col gap-4 border-b border-border/60 pb-6 sm:mb-8 sm:flex-row sm:items-start sm:justify-between sm:gap-6'
      }
    >
      <div className="min-w-0 space-y-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{eyebrow}</p>
        <h1
          className={
            compact
              ? 'text-lg font-bold tracking-tight text-foreground sm:text-xl'
              : 'text-xl font-semibold tracking-tight text-foreground sm:text-2xl'
          }
        >
          {title}
        </h1>
        {subtitle ? (
          <p className="truncate text-sm text-muted-foreground" title={subtitle}>
            {subtitle}
          </p>
        ) : null}
        {description ? (
          <p
            className={
              compact
                ? 'mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:mt-2 sm:text-sm'
                : 'mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground'
            }
          >
            {description}
          </p>
        ) : null}
      </div>
      {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  );
}
