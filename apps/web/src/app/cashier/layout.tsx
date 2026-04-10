import { CashierGuard } from '@/components/dashboard/cashier-guard';

export const dynamic = 'force-dynamic';

export default function CashierLayout({ children }: { children: React.ReactNode }) {
  return <CashierGuard>{children}</CashierGuard>;
}
