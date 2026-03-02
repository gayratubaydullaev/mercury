'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Message = {
  id: string;
  content: string;
  senderId: string;
  sender: { id: string; firstName: string; lastName: string };
  createdAt: string;
};

type Session = {
  id: string;
  buyer: { id: string; firstName: string; lastName: string };
  seller: {
    id: string;
    firstName: string;
    lastName: string;
    shop?: { chatEnabled: boolean } | null;
  };
  product: { id: string; title: string; slug: string } | null;
};

function getMyId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const t = localStorage.getItem('accessToken');
    if (!t) return '';
    const b64 = t.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!b64) return '';
    const payload = JSON.parse(atob(b64));
    return payload?.sub ?? '';
  } catch {
    return '';
  }
}

const POLL_INTERVAL_MS = 4000;

export default function ChatRoomPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const myId = getMyId();

  const loadSession = useCallback(() => {
    if (!token || !id) return;
    apiFetch(`${API_URL}/chat/sessions/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setSession)
      .catch(() => setSession(null));
  }, [token, id]);

  const loadMessages = useCallback(() => {
    if (!token || !id) return;
    apiFetch(`${API_URL}/chat/sessions/${id}/messages`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setMessages(Array.isArray(data) ? data : []))
      .catch(() => setMessages([]));
  }, [token, id]);

  useEffect(() => {
    if (!token) {
      router.replace('/auth/login?next=/chat/' + id);
      return;
    }
    loadSession();
    loadMessages();
  }, [token, id, router, loadSession, loadMessages]);

  useEffect(() => {
    if (!token || !id) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') loadMessages();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [token, id, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !token || !id) return;
    setLoading(true);
    apiFetch(`${API_URL}/chat/sessions/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: text }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(typeof data?.message === 'string' ? data.message : 'Xabar yuborishda xatolik');
        return data as Message;
      })
      .then((newMsg) => {
        setMessages((prev) => (prev ? [...prev, newMsg] : [newMsg]));
        setInput('');
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Xabar yuborishda xatolik');
      })
      .finally(() => setLoading(false));
  };

  if (!token) return null;
  if (messages === null)
    return (
      <div className="w-full max-w-lg mx-auto px-0 sm:px-4 md:px-6 p-4">
        <Skeleton className="h-12 w-full rounded-lg mb-4" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );

  const otherUser = session
    ? myId === session.buyer.id
      ? session.seller
      : session.buyer
    : null;
  const isSeller = session ? myId === session.seller.id : false;
  const isBuyer = session ? myId === session.buyer.id : false;
  const sellerChatDisabled = isBuyer && session?.seller?.shop?.chatEnabled === false;
  const headerTitle = otherUser
    ? `${otherUser.firstName} ${otherUser.lastName}`.trim() || (isSeller ? 'Xaridor' : 'Sotuvchi')
    : 'Suhbat';
  const headerRoleLabel = otherUser ? (isSeller ? 'Xaridor' : 'Sotuvchi') : null;

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col min-w-0 h-[calc(100vh-8rem)] pb-24 bg-background px-0 sm:px-4">
      <div className="flex items-center gap-2 p-3 border-b shrink-0 bg-card">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/chat"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <MessageCircle className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold truncate">{headerTitle}</h1>
            {headerRoleLabel && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{headerRoleLabel}</span>
            )}
          </div>
          {session?.product && (
            <Link href={`/product/${session.product.id}`} className="text-xs text-muted-foreground truncate block hover:text-primary hover:underline">
              {isSeller && <span className="text-muted-foreground/80">Tovar: </span>}
              {session.product.title}
            </Link>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {sellerChatDisabled && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-200">
            Sotuvchi hozircha yangi xabarlarni qabul qilmaydi. Oldingi xabarlar saqlanadi.
          </div>
        )}
        {(!messages || messages.length === 0) && !sellerChatDisabled && (
          <p className="text-center text-muted-foreground text-sm py-8">Xabarlar yoʻq. Birinchi xabarni yozing.</p>
        )}
        {(Array.isArray(messages) ? messages : []).map((m) => {
          const isMe = m.senderId === myId;
          return (
            <div key={m.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
              <Card className={cn('max-w-[85%]', isMe ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50')}>
                <CardContent className="p-2.5 px-3">
                  {!isMe && (
                    <p className="text-xs opacity-80 mb-0.5">
                      {m.sender.firstName} {m.sender.lastName}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                  <p className={cn('text-xs mt-0.5', isMe ? 'opacity-80' : 'text-muted-foreground')}>
                    {new Date(m.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </CardContent>
              </Card>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="p-3 border-t bg-card flex gap-2 shrink-0">
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={sellerChatDisabled ? 'Sotuvchi xabarlarni o‘chirgan' : 'Xabar yozing...'}
          className="flex-1"
          disabled={loading || sellerChatDisabled}
          autoComplete="off"
        />
        <Button type="submit" disabled={loading || !input.trim() || sellerChatDisabled}>
          Yuborish
        </Button>
      </form>
    </div>
  );
}
