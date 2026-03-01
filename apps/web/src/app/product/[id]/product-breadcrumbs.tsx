import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface ProductBreadcrumbsProps {
  category?: { name: string; slug: string } | null;
  productTitle: string;
}

export function ProductBreadcrumbs({ category, productTitle }: ProductBreadcrumbsProps) {
  const truncatedTitle = productTitle.length > 40 ? productTitle.slice(0, 37) + '…' : productTitle;
  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4" aria-label="Breadcrumb">
      <Link href="/" className="hover:text-foreground transition-colors">
        Bosh sahifa
      </Link>
      <ChevronRight className="h-4 w-4 shrink-0" />
      <Link href="/catalog" className="hover:text-foreground transition-colors">
        Katalog
      </Link>
      <ChevronRight className="h-4 w-4 shrink-0" />
      {category ? (
        <>
          <Link
            href={`/catalog?category=${encodeURIComponent(category.slug)}`}
            className="hover:text-foreground transition-colors"
          >
            {category.name}
          </Link>
          <ChevronRight className="h-4 w-4 shrink-0" />
        </>
      ) : null}
      <span className="text-foreground font-medium truncate max-w-[180px] sm:max-w-none" title={productTitle}>
        {truncatedTitle}
      </span>
    </nav>
  );
}
