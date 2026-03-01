'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    <div className="w-full max-w-sm mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="text-xl sm:text-2xl font-bold mb-6">Tizimga kirish</h1>
      {reasonMessage && <p className="text-muted-foreground mb-4 text-sm sm:text-base">{reasonMessage}</p>}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Input
            type="email"
            placeholder="Email"
            autoComplete="email"
            {...register('email')}
          />
          {errors.email && <p className="text-destructive text-sm mt-1">{errors.email.message}</p>}
        </div>
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            placeholder="Parol"
            autoComplete="current-password"
            className="pr-10"
            {...register('password')}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            className={cn(
              'absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded'
            )}
            aria-label={showPassword ? 'Parolni yashirish' : 'Parolni koʻrsatish'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          {errors.password && <p className="text-destructive text-sm mt-1">{errors.password.message}</p>}
        </div>
        {submitError && <p className="text-destructive text-sm">{submitError}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Kiritilmoqda...' : 'Kirish'}
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted-foreground">
        Hisobingiz yoʻqmi? <Link href="/auth/register" className="text-primary underline">Roʻyxatdan oʻtish</Link>
      </p>
      {isDev && (
        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-muted-foreground mb-2">Kirish ishlamasa (401):</p>
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
            Test akkountlarni tiklash (admin / seller)
          </Button>
          {resetDone && <p className="text-xs text-green-600 dark:text-green-400 mt-2">{resetDone}</p>}
        </div>
      )}
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="w-full max-w-sm mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="text-xl sm:text-2xl font-bold mb-6">Tizimga kirish</h1>
      <div className="space-y-4 animate-pulse">
        <div className="h-10 rounded-md bg-muted" />
        <div className="h-10 rounded-md bg-muted" />
        <div className="h-10 rounded-md bg-muted" />
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
