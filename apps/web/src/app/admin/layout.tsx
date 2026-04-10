import dynamic from 'next/dynamic';
import { AdminGuard } from '@/components/dashboard/admin-guard';

const AdminNav = dynamic(() => import('@/components/dashboard/admin-nav').then((m) => ({ default: m.AdminNav })), { ssr: true });

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="flex min-h-dvh w-full max-w-full min-w-0 flex-1 flex-col overflow-x-hidden md:min-h-0 md:flex-row">
        <AdminNav />
        <main
          className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden overflow-y-auto border-border/40 bg-muted/20 px-4 pb-[env(safe-area-inset-bottom,0px)] pt-4 dark:bg-background/50 sm:px-5 sm:pt-5 md:border-l md:px-6 md:pt-6 lg:px-8 xl:px-10 2xl:px-12"
          data-dashboard-main
        >
          <div className="mx-auto w-full max-w-[1600px] flex-1">{children}</div>
        </main>
      </div>
    </AdminGuard>
  );
}
