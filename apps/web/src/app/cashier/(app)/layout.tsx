import { CashierChrome } from '@/components/dashboard/cashier-chrome';

export default function CashierAppLayout({ children }: { children: React.ReactNode }) {
  return <CashierChrome>{children}</CashierChrome>;
}
