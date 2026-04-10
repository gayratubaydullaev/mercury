'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { API_URL } from '@/lib/utils';
import { loginSchema, type LoginInput } from '@/lib/validations';

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

const TELEGRAM_POLL_INTERVAL = 2000;
const TELEGRAM_POLL_MAX_ATTEMPTS = 150; // ~5 min

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';
  const reason = searchParams.get('reason') || '';

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [tgLoading, setTgLoading] = useState(false);
  const [tgWaiting, setTgWaiting] = useState(false);
  const [tgError, setTgError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const startTelegramLogin = () => {
    setTgError('');
    setTgLoading(true);
    apiFetch(API_URL + '/auth/telegram/request-login', { method: 'POST' })
      .then(async (r) => {
        const data = (await r.json()) as { token?: string; loginUrl?: string; message?: string };
        if (!r.ok) {
          setTgError(data?.message ?? 'Telegram kirish sozlanmagan. (Server sozlamalarini tekshiring.)');
          setTgLoading(false);
          return;
        }
        if (!data.token || !data.loginUrl) {
          setTgError(data?.message ?? 'Telegram kirish sozlanmagan.');
          setTgLoading(false);
          return;
        }
        const loginToken = data.token;
        window.open(data.loginUrl, '_blank', 'noopener');
        setTgWaiting(true);
        setTgLoading(false);
        let attempts = 0;
        pollRef.current = setInterval(() => {
          attempts += 1;
          if (attempts > TELEGRAM_POLL_MAX_ATTEMPTS) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setTgWaiting(false);
            setTgError('Vaqt tugadi. Qayta urinib koʻring.');
            return;
          }
          fetch(`${API_URL}/auth/telegram/verify?token=${encodeURIComponent(loginToken)}`, { credentials: 'include' })
            .then((r) => r.json())
            .then((res: { status?: string; accessToken?: string; user?: { role?: string } }) => {
              if (res.status === 'pending') return;
              if (res.accessToken) {
                if (pollRef.current) clearInterval(pollRef.current);
                pollRef.current = null;
                setTgWaiting(false);
                localStorage.setItem('accessToken', res.accessToken);
                window.dispatchEvent(new Event('auth-change'));
                const dest =
                  res.user?.role === 'CASHIER' && !String(next || '').startsWith('/cashier')
                    ? '/cashier/pos'
                    : next;
                router.push(dest);
                router.refresh();
              }
            })
            .catch(() => {});
        }, TELEGRAM_POLL_INTERVAL);
      })
      .catch(() => {
        setTgError('Serverga ulanishda xatolik.');
        setTgLoading(false);
      });
  };

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const submit = handleSubmit((data) => {
    setLoading(true);
    setSubmitError('');
    apiFetch(API_URL + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: data.email.trim().toLowerCase(), password: data.password }),
    })
      .then(async (r) => {
        const res = await r.json();
        if (!r.ok) return Promise.reject(res);
        return res;
      })
      .then((data: { accessToken?: string; user?: { role?: string } }) => {
        if (data.accessToken) {
          localStorage.setItem('accessToken', data.accessToken);
          window.dispatchEvent(new Event('auth-change'));
          const dest =
            data.user?.role === 'CASHIER' && !String(next || '').startsWith('/cashier')
              ? '/cashier/pos'
              : next;
          router.push(dest);
          router.refresh();
        }
      })
      .catch((err) => {
        const msg = err?.message ?? err?.error ?? 'Email yoki parol notoʻgʻri';
        setSubmitError(msg === 'Invalid credentials' ? 'Email yoki parol notoʻgʻri.' : msg);
      })
      .finally(() => setLoading(false));
  });

  const reasonMessage =
    reason === 'favorites'
      ? 'Sevimlilarga qoʻshish uchun tizimga kiring'
      : next === '/checkout'
        ? 'Buyurtma berish uchun tizimga kiring'
        : null;

  return (
    <div className="w-full max-w-md mx-auto px-0 sm:px-4 md:px-6 py-8 sm:py-12">
      <Card className="border-border/80 shadow-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl sm:text-2xl flex items-center gap-2">
            <LogIn className="h-6 w-6 text-primary" aria-hidden />
            Tizimga kirish
          </CardTitle>
          <CardDescription>
            {reasonMessage ?? 'Email va parolingizni kiriting'}
          </CardDescription>
          <div className="flex flex-col gap-2 w-full mt-4" aria-label="Telegram orqali kirish">
            <span className="text-xs font-medium text-muted-foreground">Telegram bot orqali</span>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 min-h-[48px] border-[#0088cc] text-[#0088cc] hover:bg-[#0088cc]/10 hover:text-[#0088cc] bg-[#0088cc]/5 dark:bg-[#0088cc]/10"
              size="lg"
              disabled={loading || tgLoading}
              onClick={startTelegramLogin}
              id="telegram-login-btn"
            >
              {tgWaiting ? (
                <>Telegramda Start bosing, keyin shu oynaga qayting…</>
              ) : (
                <>
                  <TelegramIcon className="h-5 w-5 shrink-0" />
                  Telegram orqali kirish
                </>
              )}
            </Button>
            {tgError && (
              <p className="text-sm text-destructive text-center" role="alert">{tgError}</p>
            )}
          </div>
          <div className="relative flex items-center gap-2 w-full pt-2 mt-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">yoki email bilan</span>
            <div className="flex-1 h-px bg-border" />
          </div>
        </CardHeader>
        <form onSubmit={submit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="name@example.com"
                autoComplete="email"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-destructive text-sm" role="alert">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Parol</Label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pr-10"
                  aria-invalid={!!errors.password}
                  {...register('password')}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className={cn(
                    'absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground rounded-md p-1',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  )}
                  aria-label={showPassword ? 'Parolni yashirish' : 'Parolni koʻrsatish'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-destructive text-sm" role="alert">{errors.password.message}</p>
              )}
            </div>
            {submitError && (
              <div className="rounded-lg bg-destructive/10 text-destructive text-sm p-3" role="alert">
                {submitError}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full gap-2" size="lg" disabled={loading || tgLoading || tgWaiting}>
              {loading ? 'Kiritilmoqda...' : 'Kirish'}
              <LogIn className="h-4 w-4" />
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Hisobingiz yoʻqmi?{' '}
              <Link href="/auth/register" className="text-primary font-medium hover:underline underline-offset-2">
                Roʻyxatdan oʻtish
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="w-full max-w-md mx-auto px-0 sm:px-4 md:px-6 py-8 sm:py-12">
      <div className="rounded-xl border bg-card p-6 shadow-md animate-pulse">
        <div className="h-7 w-40 bg-muted rounded mb-2" />
        <div className="h-4 w-56 bg-muted rounded mb-6" />
        <div className="space-y-4">
          <div className="h-10 rounded-lg bg-muted" />
          <div className="h-10 rounded-lg bg-muted" />
          <div className="h-10 rounded-lg bg-muted mt-6" />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
