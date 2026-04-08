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
        'overflow-hidden rounded-xl border border-border/80 bg-card text-card-foreground shadow-sm',
        padded && 'p-4 sm:p-5 md:p-6',
        className
      )}
    >
      {children}
    </div>
  );
}
