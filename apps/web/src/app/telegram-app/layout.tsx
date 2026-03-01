import Script from 'next/script';

export const metadata = {
  title: 'MyShopUZ — Telegram',
  description: "Do'kon Telegram orqali",
  robots: 'noindex, nofollow',
};

export default function TelegramAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      {children}
    </>
  );
}
