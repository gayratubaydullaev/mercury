import { NotificationsPageContent } from '@/components/dashboard/notifications-page-content';

export default function SellerNotificationsPage() {
  return (
    <NotificationsPageContent
      basePath="/seller"
      title="Bildirishnomalar"
      eyebrow="Sotuvchi kabineti"
      description="Buyurtmalar va doʻkon boʻyicha xabarnomalar."
    />
  );
}
