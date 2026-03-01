import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t bg-muted/30 mt-auto w-full">
      <div className="w-full px-4 md:px-6 py-6 md:py-8 lg:py-12">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-8">
          <div>
            <h3 className="font-semibold mb-2 md:mb-3 text-sm md:text-base">Doʻkon</h3>
            <ul className="space-y-1.5 md:space-y-2.5 text-xs md:text-sm text-muted-foreground">
              <li>
                <Link href="/catalog" className="hover:text-foreground transition-colors">
                  Katalog
                </Link>
              </li>
              <li>
                <Link href="/catalog?sortBy=price&sortOrder=asc" className="hover:text-foreground transition-colors">
                  Arzon narxlarda
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2 md:mb-3 text-sm md:text-base">Xaridorlar uchun</h3>
            <ul className="space-y-1.5 md:space-y-2.5 text-xs md:text-sm text-muted-foreground">
              <li>
                <Link href="/cart" className="hover:text-foreground transition-colors">
                  Savatcha
                </Link>
              </li>
              <li>
                <Link href="/favorites" className="hover:text-foreground transition-colors">
                  Sevimlilar
                </Link>
              </li>
              <li>
                <Link href="/account" className="hover:text-foreground transition-colors">
                  Profil
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2 md:mb-3 text-sm md:text-base">Yordam</h3>
            <ul className="space-y-1.5 md:space-y-2.5 text-xs md:text-sm text-muted-foreground">
              <li>
                <Link href="/" className="hover:text-foreground transition-colors">
                  Yetkazib berish
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-foreground transition-colors">
                  Toʻlov usullari
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="hover:text-foreground transition-colors">
                  Cookie siyosati
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-foreground transition-colors">
                  Aloqa
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2 md:mb-3 text-sm md:text-base">Hisob</h3>
            <ul className="space-y-1.5 md:space-y-2.5 text-xs md:text-sm text-muted-foreground">
              <li>
                <Link href="/auth/login" className="hover:text-foreground transition-colors">
                  Kirish
                </Link>
              </li>
              <li>
                <Link href="/auth/register" className="hover:text-foreground transition-colors">
                  Roʻyxatdan oʻtish
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-6 md:mt-8 lg:mt-12 pt-6 md:pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <p className="text-xs md:text-sm text-muted-foreground">
            © {new Date().getFullYear()} MyShopUZ. Barcha huquqlar himoyalangan.
          </p>
        </div>
      </div>
    </footer>
  );
}
