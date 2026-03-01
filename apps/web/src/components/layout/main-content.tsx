'use client';

import { usePathname } from 'next/navigation';

export function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isProductPage = pathname?.startsWith('/product/');
  return (
    <main
      className={
        isProductPage
          ? 'w-full flex-1'
          : 'w-full px-0.5 md:px-6 pt-1 md:pt-4 pb-6 flex-1'
      }
    >
      {children}
    </main>
  );
}
