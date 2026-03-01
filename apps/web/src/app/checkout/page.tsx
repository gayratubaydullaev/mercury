import Link from 'next/link';
import { CheckoutForm } from './checkout-form';

export const metadata = { title: 'Buyurtma' };

export default function CheckoutPage() {
  return (
    <div className="max-w-lg mx-auto px-4 pb-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/cart" className="text-muted-foreground hover:text-foreground">← Savatcha</Link>
        <h1 className="text-2xl font-bold">Buyurtma berish</h1>
      </div>
      <CheckoutForm />
    </div>
  );
}
