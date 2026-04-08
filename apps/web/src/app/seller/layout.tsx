import dynamic from 'next/dynamic';
import { SellerGuard } from '@/components/dashboard/seller-guard';

const SellerNav = dynamic(() => import('@/components/dashboard/seller-nav').then((m) => ({ default: m.SellerNav })), { ssr: true });

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <SellerGuard>
      <div className="flex min-h-dvh w-full max-w-full min-w-0 flex-1 flex-col md:min-h-0 md:flex-row">
        <SellerNav />
        <main className="mx-auto flex w-full min-w-0 max-w-[min(100%,1400px)] flex-1 overflow-auto p-4 pb-[env(safe-area-inset-bottom,0px)] sm:p-5 md:p-6">{children}</main>
      </div>
    </SellerGuard>
  );
}
