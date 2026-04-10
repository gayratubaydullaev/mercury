import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type DashboardPanelProps = {
  children: ReactNode;
  className?: string;
  /** Ichki kontent uchun padding (sukut: true) */
  padded?: boolean;
};

/** Katalog/admin roʻyxatlari uchun bir xil «kartochka» fon */
export function DashboardPanel({ children, className, padded = false }: DashboardPanelProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border/70 bg-card text-card-foreground shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.04]',
        padded && 'p-4 sm:p-5 md:p-6',
        className
      )}
    >
      {children}
    </div>
  );
}
