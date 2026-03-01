import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Package, ShoppingBag, BarChart3, Settings } from 'lucide-react';

export const metadata = { title: 'Sotuvchi kabineti' };

const tiles = [
  { href: '/seller/products', label: 'Tovarlar', desc: 'CRUD, rasmlar, qoldiq', icon: Package },
  { href: '/seller/orders', label: 'Buyurtmalar', desc: 'Tasdiqlash, yuborish', icon: ShoppingBag },
  { href: '/seller/stats', label: 'Statistika', desc: 'Sotuvlar, daromad', icon: BarChart3 },
  { href: '/seller/settings', label: 'Doʻkon sozlamalari', desc: 'Nomi, manzil, oʻzim olib ketish', icon: Settings },
];

export default function SellerDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Sotuvchi kabineti</h1>
      <p className="text-muted-foreground mb-6">Doʻkoningiz va buyurtmalarni boshqarish</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {tiles.map(({ href, label, desc, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="h-full transition-colors hover:bg-accent/50 hover:border-primary/30">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold">{label}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
