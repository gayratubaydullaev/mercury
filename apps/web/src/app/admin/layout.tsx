import dynamic from 'next/dynamic';
import { AdminGuard } from '@/components/dashboard/admin-guard';

const AdminNav = dynamic(() => import('@/components/dashboard/admin-nav').then((m) => ({ default: m.AdminNav })), { ssr: true });

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="flex flex-col md:flex-row min-h-0 flex-1 w-full max-w-full min-w-0 overflow-x-hidden">
        <AdminNav />
        <main className="flex-1 min-w-0 w-full max-w-full p-4 sm:p-5 md:p-6 overflow-auto pb-[env(safe-area-inset-bottom,0px)]">{children}</main>
      </div>
    </AdminGuard>
  );
}
