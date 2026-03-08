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
import { PublicSettingsProvider } from '@/contexts/public-settings-context';
import { TelegramWebAppProvider } from '@/contexts/telegram-webapp-context';
import { TelegramThemeApplicator } from '@/components/telegram-theme-applicator';
import { TelegramBackButton } from '@/components/telegram-back-button';
import { TelegramBackHandlerProvider } from '@/contexts/telegram-back-handler-context';
import { TelegramWebAppAuth } from '@/components/telegram-webapp-auth';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-geist-sans' });

const DEFAULT_SITE_NAME = 'JomboyShop';

export async function generateMetadata(): Promise<Metadata> {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  let apiUrl = raw?.includes(',') ? raw.split(',')[0].trim() : raw;
  if (apiUrl && !/^https?:\/\//i.test(apiUrl)) apiUrl = 'https://' + apiUrl;
  let siteName = DEFAULT_SITE_NAME;
  if (apiUrl) {
    try {
      const res = await fetch(`${apiUrl}/settings/public`, { next: { revalidate: 60 } });
      const data = (await res.json()) as { siteName?: string };
      if (data?.siteName?.trim()) siteName = data.siteName.trim();
    } catch {
      // use default
    }
  }
  return {
    title: { default: `${siteName} – Doʻkon`, template: `%s | ${siteName}` },
    description: `Oʻzbekiston boʻylab xaridlar – ${siteName} markazida.`,
    openGraph: { type: 'website', locale: 'uz_Latn' },
    robots: { index: true, follow: true },
    manifest: '/manifest.json',
    icons: { icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }] },
  };
}

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
            <TelegramBackHandlerProvider>
              <TelegramBackButton />
          <AuthProvider>
            <PublicSettingsProvider>
              <TelegramWebAppAuth />
              <CsrfPrefetch />
              <PwaRegister />
              <ShellWrapper>{children}</ShellWrapper>
              <CookieNotice />
              <Toaster />
            </PublicSettingsProvider>
          </AuthProvider>
            </TelegramBackHandlerProvider>
          </TelegramWebAppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
