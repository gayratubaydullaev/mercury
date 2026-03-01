import Link from 'next/link';

const footerSections = [
  {
    title: 'Doʻkon',
    links: [
      { href: '/catalog', label: 'Katalog' },
      { href: '/catalog?sortBy=price&sortOrder=asc', label: 'Arzon narxlarda' },
    ],
  },
  {
    title: 'Xaridorlar uchun',
    links: [
      { href: '/cart', label: 'Savatcha' },
      { href: '/favorites', label: 'Sevimlilar' },
      { href: '/account', label: 'Profil' },
    ],
  },
  {
    title: 'Yordam',
    links: [
      { href: '/', label: 'Yetkazib berish' },
      { href: '/', label: 'Toʻlov usullari' },
      { href: '/cookies', label: 'Cookie siyosati' },
      { href: '/', label: 'Aloqa' },
    ],
  },
  {
    title: 'Hisob',
    links: [
      { href: '/auth/login', label: 'Kirish' },
      { href: '/auth/register', label: "Roʻyxatdan oʻtish" },
      { href: '/become-seller', label: "Sotuvchi boʻlish" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border/80 bg-muted/20 mt-auto w-full">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-10 lg:py-12">
        <div className="grid grid-cols-2 gap-8 sm:gap-10 md:grid-cols-4">
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="font-semibold text-foreground mb-3 md:mb-4 text-sm">
                {section.title}
              </h3>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 md:mt-12 pt-6 md:pt-8 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} MyShopUZ. Barcha huquqlar himoyalangan.
          </p>
          <Link href="/" className="font-semibold text-primary hover:underline underline-offset-2 text-sm">
            MyShopUZ
          </Link>
        </div>
      </div>
    </footer>
  );
}
