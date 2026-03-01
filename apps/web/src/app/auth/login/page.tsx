'use client';

import { useState, useEffect, Suspense } from 'react';
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

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';
  const reason = searchParams.get('reason') || '';

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [resetDone, setResetDone] = useState('');
  const [mounted, setMounted] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => setMounted(true), []);
  const isDev =
    mounted &&
    process.env.NODE_ENV !== 'production' &&
    (API_URL.includes('localhost') || API_URL.includes('127.0.0.1') || API_URL === '/api-proxy');

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
      .then((data) => {
        if (data.accessToken) {
          localStorage.setItem('accessToken', data.accessToken);
          window.dispatchEvent(new Event('auth-change'));
          router.push(next);
          router.refresh();
        }
      })
      .catch((err) => {
        const msg = err?.message ?? err?.error ?? 'Email yoki parol notoʻgʻri';
        setSubmitError(msg === 'Invalid credentials' ? 'Email yoki parol notoʻgʻri. (Admin: admin@myshop.uz / Admin123!)' : msg);
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
    <div className="w-full max-w-md mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <Card className="border-border/80 shadow-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl sm:text-2xl flex items-center gap-2">
            <LogIn className="h-6 w-6 text-primary" aria-hidden />
            Tizimga kirish
          </CardTitle>
          <CardDescription>
            {reasonMessage ?? 'Email va parolingizni kiriting'}
          </CardDescription>
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
            <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
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
      {isDev && (
        <Card className="mt-6 border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Development</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={loading}
              onClick={() => {
                setSubmitError('');
                setResetDone('');
                apiFetch(API_URL + '/auth/dev-reset-seed-users', { method: 'POST' })
                  .then((r) => r.json())
                  .then((data) => {
                    setResetDone(data?.message ?? 'Tayyor. admin@myshop.uz / Admin123! bilan kiring.');
                    setValue('email', 'admin@myshop.uz');
                    setValue('password', 'Admin123!');
                  })
                  .catch(() => setSubmitError('API ga ulanishda xatolik'));
              }}
            >
              Test akkountlarni tiklash
            </Button>
            {resetDone && <p className="text-xs text-green-600 dark:text-green-400">{resetDone}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="w-full max-w-md mx-auto px-4 sm:px-6 py-8 sm:py-12">
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
