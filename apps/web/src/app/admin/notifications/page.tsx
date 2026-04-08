import { NotificationsPageContent } from '@/components/dashboard/notifications-page-content';

export default function AdminNotificationsPage() {
  return (
    <NotificationsPageContent
      basePath="/admin"
      title="Bildirishnomalar"
      eyebrow="Platforma"
      description="Admin va tizim xabarlari."
    />
  );
}
