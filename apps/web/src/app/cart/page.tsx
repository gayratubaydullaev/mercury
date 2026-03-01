import Link from 'next/link';
import { CartContent } from './cart-content';

export const metadata = { title: 'Savatcha' };

export default function CartPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 pb-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/catalog" className="text-muted-foreground hover:text-foreground">← Katalog</Link>
        <h1 className="text-2xl font-bold">Savatcha</h1>
      </div>
      <CartContent />
    </div>
  );
}
