'use client';

import { usePathname } from 'next/navigation';

export function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isProductPage = pathname?.startsWith('/product/');
  return (
    <main
      className={
        isProductPage
          ? 'w-full max-w-full min-w-0 flex-1'
          : 'w-full max-w-full min-w-0 px-3 sm:px-4 md:px-6 pt-1 md:pt-4 pb-6 flex-1'
      }
    >
      {children}
    </main>
  );
}
