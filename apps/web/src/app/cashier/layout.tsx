import { CashierGuard } from '@/components/dashboard/cashier-guard';
import { CashierChrome } from '@/components/dashboard/cashier-chrome';

export const dynamic = 'force-dynamic';

export default function CashierLayout({ children }: { children: React.ReactNode }) {
  return (
    <CashierGuard>
      <CashierChrome>{children}</CashierChrome>
    </CashierGuard>
  );
}
