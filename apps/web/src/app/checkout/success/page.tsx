import { Suspense } from 'react';
import { CheckoutSuccessContent } from './checkout-success-content';

export const metadata = { title: 'Buyurtma qabul qilindi' };

export default function CheckoutSuccessPage() {
  return (
    <div className="w-full max-w-2xl mx-auto px-0 sm:px-4 md:px-6 py-8">
      <Suspense fallback={<div className="animate-pulse h-24 bg-muted rounded-lg" />}>
        <CheckoutSuccessContent />
      </Suspense>
    </div>
  );
}
