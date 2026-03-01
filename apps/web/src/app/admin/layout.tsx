import dynamic from 'next/dynamic';
import { AdminGuard } from '@/components/dashboard/admin-guard';

const AdminNav = dynamic(() => import('@/components/dashboard/admin-nav').then((m) => ({ default: m.AdminNav })), { ssr: true });

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="flex flex-col md:flex-row min-h-0 flex-1">
        <AdminNav />
        <main className="flex-1 min-w-0 p-4 md:p-6 overflow-auto">{children}</main>
      </div>
    </AdminGuard>
  );
}
