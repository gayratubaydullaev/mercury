import { TelegramWebAppInit } from '@/components/telegram-webapp-init';

export const metadata = {
  title: 'MyShopUZ — Telegram',
  description: "Do'kon Telegram orqali",
  robots: 'noindex, nofollow',
};

export default function TelegramAppLayout({ children }: { children: React.ReactNode }) {
  return <TelegramWebAppInit>{children}</TelegramWebAppInit>;
}
