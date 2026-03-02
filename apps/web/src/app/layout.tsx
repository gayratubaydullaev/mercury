import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { ShellWrapper } from '@/components/layout/shell-wrapper';
import { CookieNotice } from '@/components/layout/cookie-notice';
import { PwaRegister } from '@/components/pwa-register';
import { CsrfPrefetch } from '@/components/csrf-prefetch';
import { AuthProvider } from '@/contexts/auth-context';
import { TelegramWebAppProvider } from '@/contexts/telegram-webapp-context';
import { TelegramThemeApplicator } from '@/components/telegram-theme-applicator';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-geist-sans' });

export const metadata: Metadata = {
  title: { default: "MyShopUZ – Do'kon", template: '%s | MyShopUZ' },
  description: "O'zbekiston bo'ylab xaridlar – MyShopUZ markazida.",
  openGraph: { type: 'website', locale: 'uz_Latn' },
  robots: { index: true, follow: true },
  manifest: '/manifest.json',
  icons: { icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }] },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover' as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <body className={inter.variable + ' font-sans antialiased min-h-screen bg-background text-foreground overflow-x-hidden'}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TelegramWebAppProvider>
            <TelegramThemeApplicator />
          <AuthProvider>
            <CsrfPrefetch />
            <PwaRegister />
            <ShellWrapper>{children}</ShellWrapper>
            <CookieNotice />
          <Toaster />
          </AuthProvider>
          </TelegramWebAppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
