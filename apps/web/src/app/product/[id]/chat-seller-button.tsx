'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MessageCircle, MessageCircleOff } from 'lucide-react';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

export function ChatSellerButton({
  sellerId,
  productId,
  chatEnabled = true,
  className,
}: {
  sellerId: string;
  productId: string;
  chatEnabled?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const startChat = () => {
    if (!chatEnabled) return;
    if (!token) {
      router.push('/auth/login?next=/product/' + productId + '&reason=chat');
      return;
    }
    setLoading(true);
    apiFetch(`${API_URL}/chat/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sellerId, productId }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((e: { message?: string }) => { throw new Error(e.message); });
        return r.json();
      })
      .then((session: { id: string }) => {
        router.push('/chat/' + session.id);
      })
      .catch(() => setLoading(false))
      .finally(() => setLoading(false));
  };

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={className}
        onClick={startChat}
        disabled={loading || !chatEnabled}
        title={!chatEnabled ? 'Sotuvchi hozircha xabarlarni qabul qilmaydi' : undefined}
      >
        {chatEnabled ? (
          <MessageCircle className="h-4 w-4 mr-1.5" />
        ) : (
          <MessageCircleOff className="h-4 w-4 mr-1.5 text-muted-foreground" />
        )}
        {chatEnabled ? 'Sotuvchiga yozish' : 'Chat o‘chirilgan'}
      </Button>
      {!chatEnabled && (
        <p className="text-[10px] text-muted-foreground">Sotuvchi xabarlarni o‘chirgan</p>
      )}
    </div>
  );
}
