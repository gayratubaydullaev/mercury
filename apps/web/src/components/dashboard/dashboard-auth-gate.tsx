import Link from 'next/link';
import { Button } from '@/components/ui/button';

/** Client sahifalar uchun sodda «kiirish kerak» blok */
export function DashboardAuthGate() {
  return (
    <DashboardAuthGateLayout>
      <p className="text-sm text-muted-foreground">Davom etish uchun hisobingizga kiring.</p>
      <Button asChild>
        <Link href="/auth/login">Kirish</Link>
      </Button>
    </DashboardAuthGateLayout>
  );
}

export function DashboardAuthGateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/80 bg-muted/15 px-6 py-10 text-center">
      {children}
    </div>
  );
}
