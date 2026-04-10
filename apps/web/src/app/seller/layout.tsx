import { SellerGuard } from '@/components/dashboard/seller-guard';

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return <SellerGuard>{children}</SellerGuard>;
}
