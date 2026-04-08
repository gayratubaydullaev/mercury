import type { ReactNode } from 'react';

type DashboardPageHeaderProps = {
  title: string;
  description?: string;
  /** Qisqa yuqori sarlavha (masalan: «Platforma» yoki «Sotuvchi kabineti») */
  eyebrow?: string;
  /** Ikkilamchi qator (masalan, doʻkon nomi) */
  subtitle?: string;
  children?: ReactNode;
};

export function DashboardPageHeader({
  title,
  description,
  eyebrow = 'Boshqaruv paneli',
  subtitle,
  children,
}: DashboardPageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 mb-6 sm:mb-8">
      <div className="min-w-0 space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{eyebrow}</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle ? (
          <p className="truncate text-sm text-muted-foreground" title={subtitle}>
            {subtitle}
          </p>
        ) : null}
        {description ? <p className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">{description}</p> : null}
      </div>
      {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  );
}
