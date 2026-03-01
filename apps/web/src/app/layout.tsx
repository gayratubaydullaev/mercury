import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { Header } from '@/components/layout/header';
import { BannerCarouselWrapper } from '@/components/layout/banner-carousel-wrapper';
import { MainContent } from '@/components/layout/main-content';
import { Footer } from '@/components/layout/footer';
import { BottomNav } from '@/components/layout/bottom-nav';
import { CookieNotice } from '@/components/layout/cookie-notice';
import { PwaRegister } from '@/components/pwa-register';
import { CsrfPrefetch } from '@/components/csrf-prefetch';
import { AuthProvider } from '@/contexts/auth-context';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-geist-sans' });

export const metadata: Metadata = {
  title: { default: "MyShopUZ – Do'kon", template: '%s | MyShopUZ' },
  description: "O'zbekiston bo'ylab xaridlar – MyShopUZ markazida.",
  openGraph: { type: 'website', locale: 'uz_Latn' },
  robots: { index: true, follow: true },
  manifest: '/manifest.json',
  icons: { icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <body className={inter.variable + ' font-sans antialiased min-h-screen bg-background text-foreground overflow-x-hidden'}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <CsrfPrefetch />
            <PwaRegister />
            <div className="flex flex-col min-h-screen w-full max-w-full min-w-0">
            <Header />
            <BannerCarouselWrapper />
            <div className="flex-1 pb-20 md:pb-0 flex flex-col">
              <MainContent>{children}</MainContent>
              <Footer />
            </div>
          </div>
          <BottomNav />
          <CookieNotice />
          <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
