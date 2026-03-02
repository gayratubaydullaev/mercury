'use client';

import { usePathname } from 'next/navigation';

export function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isProductPage = pathname?.startsWith('/product/');
  return (
    <main
      className={
        isProductPage
          ? 'w-full max-w-full min-w-0 flex-1 overflow-x-hidden'
          : 'w-full max-w-full min-w-0 overflow-x-hidden px-0 sm:px-3 md:px-6 pt-3 sm:pt-4 md:pt-5 pb-8 flex-1'
      }
    >
      {isProductPage ? children : <div className="max-w-[1600px] mx-auto min-w-0">{children}</div>}
    </main>
  );
}
