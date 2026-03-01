import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { API_URL } from '@/lib/utils';
import { ReviewsSection } from '../reviews-section';

async function getProduct(id: string) {
  const res = await fetch(`${API_URL}/products/${id}`, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  return res.json();
}

async function getReviews(productId: string) {
  const res = await fetch(`${API_URL}/reviews/product/${productId}`, { next: { revalidate: 30 } });
  if (!res.ok) return [];
  return res.json();
}

export default async function ProductReviewsPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const [product, reviews] = await Promise.all([getProduct(id), getReviews(id)]);
  if (!product) notFound();

  return (
    <div className="min-h-screen bg-muted/50">
      <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-12 min-w-0">
        <Link
          href={`/product/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ChevronLeft className="h-4 w-4" />
          Tovarga qaytish
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-1 break-words">{product.title}</h1>
        <p className="text-sm text-muted-foreground mb-8">Barcha sharhlar</p>
        <ReviewsSection productId={id} initialReviews={reviews} showViewAllButton={false} compact={false} />
      </main>
    </div>
  );
}
