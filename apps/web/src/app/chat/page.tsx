'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageCircle } from 'lucide-react';

type Session = {
  id: string;
  updatedAt: string;
  buyer: { firstName: string; lastName: string };
  seller: { firstName: string; lastName: string };
  product: { title: string; slug: string } | null;
  messages: { content: string }[];
};

export default function ChatListPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [asBuyer, setAsBuyer] = useState(true);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  useEffect(() => {
    if (!token) {
      router.replace('/auth/login?next=/chat');
      return;
    }
    const q = asBuyer ? '?as=buyer' : '?as=seller';
    apiFetch(`${API_URL}/chat/sessions${q}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setSessions)
      .catch(() => setSessions([]));
  }, [token, asBuyer, router]);

  if (!token) return null;
  if (sessions === null) {
    return (
      <div className="max-w-lg mx-auto p-4">
        <Skeleton className="h-24 w-full rounded-lg mb-3" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }

  const otherName = (s: Session) =>
    asBuyer
      ? `${s.seller.firstName} ${s.seller.lastName}`.trim() || 'Sotuvchi'
      : `${s.buyer.firstName} ${s.buyer.lastName}`.trim() || 'Xaridor';
  /** Для продавца — «Xaridor», для покупателя — «Sotuvchi» */
  const otherRoleLabel = asBuyer ? 'Sotuvchi' : 'Xaridor';
  const lastMsg = (s: Session) => s.messages?.[0]?.content ?? '—';

  function formatSessionTime(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Hozir';
    if (diffMins < 60) return `${diffMins} min`;
    if (diffHours < 24) return `${diffHours} soat`;
    if (diffDays === 1) return 'Kecha';
    if (diffDays < 7) return `${diffDays} kun`;
    return d.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' });
  }

  return (
    <div className="max-w-lg mx-auto p-4 pb-24">
      <h1 className="text-2xl font-bold mb-4">Xabarlar</h1>
      <div className="flex gap-2 mb-4">
        <Button variant={asBuyer ? 'default' : 'outline'} size="sm" onClick={() => setAsBuyer(true)}>
          Mening suhbatlarim
        </Button>
        <Button variant={!asBuyer ? 'default' : 'outline'} size="sm" onClick={() => setAsBuyer(false)}>
          Doʻkon suhbatlari
        </Button>
      </div>
      {sessions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground space-y-2">
          <p>Hali suhbatlar yoʻq.</p>
          {!asBuyer && (
            <p className="text-sm max-w-xs mx-auto">Xaridorlar tovar sahifasidagi «Sotuvchiga yozish» tugmasi orqali siz bilan bogʻlanishi mumkin.</p>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link href={`/chat/${s.id}`}>
                <Card className="hover:bg-muted/50 transition-colors">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <MessageCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-medium truncate">{otherName(s)}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{otherRoleLabel}</span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{formatSessionTime(s.updatedAt)}</span>
                      </div>
                      {s.product && (
                        <p className="text-xs text-muted-foreground truncate">
                          {!asBuyer && <span className="text-muted-foreground/80">Tovar: </span>}
                          {s.product.title}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground truncate">{lastMsg(s)}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
