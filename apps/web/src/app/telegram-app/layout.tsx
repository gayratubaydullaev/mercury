import { TelegramWebAppInit } from '@/components/telegram-webapp-init';

export const metadata = {
  title: 'JomboyShop — Telegram',
  description: 'Doʻkon Telegram orqali',
  robots: 'noindex, nofollow',
};

export default function TelegramAppLayout({ children }: { children: React.ReactNode }) {
  return <TelegramWebAppInit>{children}</TelegramWebAppInit>;
}
