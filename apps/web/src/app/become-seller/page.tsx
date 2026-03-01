'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Store, CheckCircle, Clock, XCircle } from 'lucide-react';

type ApplicationStatus = {
  id: string;
  shopName: string;
  description: string | null;
  message: string | null;
  status: string;
  rejectReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export default function BecomeSellerPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState<ApplicationStatus | null>(null);
  const [canApply, setCanApply] = useState(true);
  const [shopName, setShopName] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      router.replace('/auth/login?next=/become-seller');
      return;
    }
    apiFetch(`${API_URL}/seller-application/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data: { application: ApplicationStatus | null; canApply: boolean }) => {
        setApplication(data.application ?? null);
        setCanApply(data.canApply);
        if (data.application) {
          setShopName(data.application.shopName ?? '');
          setDescription(data.application.description ?? '');
          setMessage(data.application.message ?? '');
        }
      })
      .catch(() => setApplication(null))
      .finally(() => setLoading(false));
  }, [token, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !shopName.trim()) return;
    setError(null);
    setSubmitting(true);
    apiFetch(`${API_URL}/seller-application/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        shopName: shopName.trim(),
        description: description.trim() || undefined,
        message: message.trim() || undefined,
      }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((err: { message?: string }) => Promise.reject(new Error(err?.message ?? 'Xatolik')));
        return r.json();
      })
      .then((data: { application?: ApplicationStatus }) => {
        setApplication(data.application ?? null);
        setCanApply(false);
      })
      .catch((err) => setError(err?.message ?? 'Ariza yuborishda xatolik'))
      .finally(() => setSubmitting(false));
  };

  if (!token) return null;
  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const isSeller = application?.status === 'APPROVED';
  const isPending = application?.status === 'PENDING';
  const isRejected = application?.status === 'REJECTED';

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-xl sm:text-2xl font-bold mb-2">Sotuvchi bo‘lish</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Do‘koningizni ochish uchun ariza yuboring. Admin tasdiqlagach, siz sotuvchi bo‘lasiz va tovarlar qo‘sha olasiz.
      </p>

      {isSeller && (
        <Card className="mb-6 border-green-200 dark:border-green-900">
          <CardContent className="pt-6 flex items-center gap-3">
            <CheckCircle className="h-10 w-10 text-green-600 shrink-0" />
            <div>
              <p className="font-medium text-green-700 dark:text-green-400">Siz allaqachon sotuvchisiz</p>
              <p className="text-sm text-muted-foreground mt-0.5">Do‘kon paneliga o‘ting va tovarlar qo‘shing.</p>
              <Button asChild className="mt-2" size="sm">
                <Link href="/seller">Sotuvchi paneli</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isPending && (
        <Card className="mb-6 border-amber-200 dark:border-amber-900">
          <CardContent className="pt-6 flex items-center gap-3">
            <Clock className="h-10 w-10 text-amber-600 shrink-0" />
            <div>
              <p className="font-medium">Arizangiz ko‘rib chiqilmoqda</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Admin tasdiqlagach, sizga xabar beramiz. Sahifani yangilab turing yoki keyinroq qaytib keling.
              </p>
              {application?.shopName && (
                <p className="text-sm mt-2">Do‘kon nomi: <strong>{application.shopName}</strong></p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {isRejected && (
        <Card className="mb-6 border-red-200 dark:border-red-900">
          <CardContent className="pt-6 flex items-center gap-3">
            <XCircle className="h-10 w-10 text-red-600 shrink-0" />
            <div>
              <p className="font-medium text-red-700 dark:text-red-400">Ariza rad etildi</p>
              {application?.rejectReason && (
                <p className="text-sm text-muted-foreground mt-1">{application.rejectReason}</p>
              )}
              <p className="text-sm mt-2">Agar xatolik bo‘lsa, quyidagi formadan qayta ariza yuborishingiz mumkin.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isSeller && (canApply || isRejected) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Ariza yuborish
            </CardTitle>
            <p className="text-sm text-muted-foreground font-normal">
              Do‘kon nomi va qisqacha tavsif kiriting. Admin tasdiqlagach siz sotuvchi bo‘lasiz.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Do‘kon nomi *</label>
                <Input
                  className="mt-1"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="Masalan: Mening do‘konim"
                  required
                  maxLength={200}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Tavsif (ixtiyoriy)</label>
                <textarea
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Do‘koningiz haqida qisqacha"
                  maxLength={2000}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Administratorga xabar (ixtiyoriy)</label>
                <textarea
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Qo‘shimcha ma’lumot yoki savol"
                  maxLength={1000}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Yuborilmoqda...' : 'Ariza yuborish'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <p className="text-center text-sm text-muted-foreground mt-6">
        <Link href="/" className="hover:underline">Bosh sahifaga qaytish</Link>
      </p>
    </div>
  );
}
