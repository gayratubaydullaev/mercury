import Link from 'next/link';
import { CartContent } from './cart-content';

export const metadata = { title: 'Savatcha' };

export default function CartPage() {
  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 pb-8">
      <div className="flex flex-wrap items-center gap-3 md:gap-4 mb-6">
        <Link href="/catalog" className="text-muted-foreground hover:text-foreground">← Katalog</Link>
        <h1 className="text-xl sm:text-2xl font-bold">Savatcha</h1>
      </div>
      <CartContent />
    </div>
  );
}
