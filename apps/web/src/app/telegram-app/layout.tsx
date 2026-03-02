import Script from 'next/script';
import { TelegramWebAppInit } from '@/components/telegram-webapp-init';

export const metadata = {
  title: 'MyShopUZ — Telegram',
  description: "Do'kon Telegram orqali",
  robots: 'noindex, nofollow',
};

export default function TelegramAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <TelegramWebAppInit>{children}</TelegramWebAppInit>
    </>
  );
}
