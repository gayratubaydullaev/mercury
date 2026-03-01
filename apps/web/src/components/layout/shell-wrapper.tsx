'use client';

import { usePathname } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { BannerCarouselWrapper } from '@/components/layout/banner-carousel-wrapper';
import { MainContent } from '@/components/layout/main-content';
import { Footer } from '@/components/layout/footer';
import { BottomNav } from '@/components/layout/bottom-nav';

export function ShellWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith('/telegram-app')) {
    return <>{children}</>;
  }
  return (
    <div className="flex flex-col min-h-screen w-full max-w-full min-w-0">
      <Header />
      <BannerCarouselWrapper />
      <div className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-0 flex flex-col min-w-0">
        <MainContent>{children}</MainContent>
        <Footer />
      </div>
      <BottomNav />
    </div>
  );
}
