import dynamic from 'next/dynamic';
import { AdminGuard } from '@/components/dashboard/admin-guard';

const AdminNav = dynamic(() => import('@/components/dashboard/admin-nav').then((m) => ({ default: m.AdminNav })), { ssr: true });

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="flex min-h-dvh w-full max-w-full min-w-0 flex-1 flex-col overflow-x-hidden md:min-h-0 md:flex-row">
        <AdminNav />
        <main className="mx-auto flex w-full min-w-0 max-w-[min(100%,1400px)] flex-1 overflow-auto p-4 pb-[env(safe-area-inset-bottom,0px)] sm:p-5 md:p-6">{children}</main>
      </div>
    </AdminGuard>
  );
}
