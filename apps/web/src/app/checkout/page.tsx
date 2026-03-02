import Link from 'next/link';
import { CheckoutForm } from './checkout-form';

export const metadata = { title: 'Buyurtma' };

export default function CheckoutPage() {
  return (
    <div className="w-full max-w-lg mx-auto px-0 sm:px-4 md:px-6 pb-8">
      <div className="flex flex-wrap items-center gap-3 md:gap-4 mb-6">
        <Link href="/cart" className="text-muted-foreground hover:text-foreground">← Savatcha</Link>
        <h1 className="text-xl sm:text-2xl font-bold">Buyurtma berish</h1>
      </div>
      <CheckoutForm />
    </div>
  );
}
