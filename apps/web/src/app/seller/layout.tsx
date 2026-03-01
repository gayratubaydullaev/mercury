import dynamic from 'next/dynamic';
import { SellerGuard } from '@/components/dashboard/seller-guard';

const SellerNav = dynamic(() => import('@/components/dashboard/seller-nav').then((m) => ({ default: m.SellerNav })), { ssr: true });

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <SellerGuard>
      <div className="flex flex-col md:flex-row min-h-0 flex-1 w-full max-w-full min-w-0">
        <SellerNav />
        <main className="flex-1 min-w-0 w-full max-w-full p-4 md:p-6 overflow-auto">{children}</main>
      </div>
    </SellerGuard>
  );
}
