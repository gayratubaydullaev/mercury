import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ProductBreadcrumbs } from './product-breadcrumbs';
import { ProductGalleryWithVariant } from './product-gallery-with-variant';
import { MobileProductGalleryWithVariant } from './product-gallery-with-variant';
import { ProductShopCard } from './product-shop-card';
import { ProductSpecsInline } from './product-specs-inline';
import { ProductSpecsTrigger } from './product-specs-trigger';
import { ProductSelectionProvider } from './product-selection-context';
import { ProductVariantsSection } from './product-variants-section';
import { ProductActionsSection } from './product-actions-section';
import { ProductSpecsSectionMobile } from './product-specs-section-mobile';
import { ProductRatingLabel } from './product-rating-label';
import { ReviewsSection } from './reviews-section';
import { RelatedProducts } from '@/components/product/related-products';
import { FavoriteButton } from '@/app/product/[id]/favorite-button';
import { ProductShareBtn } from '@/components/product/product-share-btn';
import { Separator } from '@/components/ui/separator';
import { API_URL, formatPrice } from '@/lib/utils';
import { ChevronLeft, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

async function getProduct(id: string) {
  const res = await fetch(`${API_URL}/products/${id}`, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  return res.json();
}

export default async function ProductPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const product = await getProduct(id);
  if (!product) notFound();

  const price = Number(product.price);
  const comparePrice = product.comparePrice != null ? Number(product.comparePrice) : null;
  const discountPercent =
    comparePrice != null && comparePrice > price
      ? Math.round((1 - price / comparePrice) * 100)
      : null;
  const options = (product.options as Record<string, string[]> | null) ?? null;
  const shop = product.shop;
  const stock = product.stock ?? 0;
  const reviews = (product.reviews as Array<{ id: string; rating: number; comment?: string | null; sellerReply?: string | null; createdAt?: string; user: { firstName: string; lastName: string } }>) ?? [];
  const reviewsCount = product.reviewsCount ?? reviews.length;
  const avgRating = product.avgRating ?? (reviews.length > 0
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : null);

  return (
    <div className="min-h-screen flex flex-col bg-muted/50">
      <main className="flex-1 pb-40 md:pb-12">
        <div className="w-full px-0 lg:px-6 py-0 lg:py-6">
          {/* Breadcrumb — только desktop */}
          <div className="hidden lg:block">
            <ProductBreadcrumbs category={product.category} productTitle={product.title} />
          </div>

          {/* DESKTOP: 3 колонки (как в Kem4yn: варианты в средней колонке) */}
          <ProductSelectionProvider product={{ ...product, stock: stock ?? 0 }}>
          <div className="hidden lg:grid lg:grid-cols-[500px_500px_260px] xl:grid-cols-[650px_650px_300px] gap-6 xl:gap-10 items-stretch">
            {/* 1. Галерея — высота по соотношению основного фото (3/4), чтобы низ средней колонки совпадал с низом фото */}
            <div className="bg-card rounded-2xl p-1 shadow-sm border border-border w-full min-h-0 overflow-hidden lg:aspect-[500/522] xl:aspect-[650/722]">
              <div className="h-full w-full min-h-0">
                <ProductGalleryWithVariant product={product} title={product.title} />
              </div>
            </div>

            {/* 2. Описание и характеристики — по ширине и высоте до края фото; остальное в модалке по кнопке */}
            <div className="flex flex-col min-w-0 min-h-0 h-full">
              <div className="space-y-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative pr-1">
                <div>
                  <h1 className="text-2xl font-bold text-foreground tracking-tight leading-tight">
                    {product.title}
                  </h1>
                  <div className="flex items-center gap-2 mt-2 text-sm">
                    <div className="flex items-center gap-1 text-yellow-600 font-bold">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span>{avgRating ?? '—'}</span>
                    </div>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">
                      <ProductRatingLabel count={reviewsCount} />
                    </span>
                  </div>
                </div>

                <ProductVariantsSection />

                <ProductSpecsInline product={product} />

                {product.description != null && product.description !== '' && (
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">Tavsif</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-4">
                      {product.description}
                    </p>
                  </div>
                )}

                <div className="sticky bottom-0 left-0 w-full h-10 bg-gradient-to-t from-background to-transparent pointer-events-none mt-2" />
              </div>

              <div className="flex-shrink-0 pt-2">
                <ProductSpecsTrigger product={product} variant="link" />
              </div>
            </div>

            {/* 3. Блок покупки (sticky) — только цена и кнопки */}
            <div className="sticky top-20">
              <div className="bg-card rounded-xl p-3 shadow-md border border-border space-y-3">
                <div className="flex items-end gap-2 flex-wrap">
                  <div className="flex flex-col">
                    <span className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
                      {formatPrice(price)} soʻm
                    </span>
                  </div>
                  {discountPercent != null && discountPercent > 0 && (
                    <div className="mb-1">
                      <span className="text-base text-muted-foreground line-through decoration-red-400 decoration-2">
                        {formatPrice(comparePrice ?? price)} soʻm
                      </span>
                      <Badge variant="destructive" className="ml-1.5 bg-red-100 text-red-600 hover:bg-red-200 border-red-200 text-[9px] px-1 h-3.5">
                        −{discountPercent}%
                      </Badge>
                    </div>
                  )}
                </div>
                <ProductActionsSection />
                {shop && (
                  <>
                    <Separator className="bg-border" />
                    <ProductShopCard shop={shop} productId={product.id} />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Блок отзывов под сеткой — как в примере */}
          <div className="hidden lg:block mt-12 mb-12">
            <ReviewsSection productId={product.id} />
          </div>

          {/* MOBILE */}
          <div className="lg:hidden flex flex-col">
            <div className="relative">
              <Link
                href="/catalog"
                className="absolute top-4 left-4 z-20 flex items-center justify-center bg-card/80 backdrop-blur-sm border border-border shadow-sm hover:bg-card h-11 w-11 rounded-full text-foreground active:scale-95 transition-all"
              >
                <ChevronLeft className="w-6 h-6" />
              </Link>
              <MobileProductGalleryWithVariant
                product={product}
                productName={product.title}
              />
              <div className="absolute top-4 right-4 z-20 flex gap-2">
                <FavoriteButton
                  productId={product.id}
                  className="bg-card/80 backdrop-blur-sm border border-border shadow-sm hover:bg-card h-11 w-11"
                />
                <ProductShareBtn
                  productName={product.title}
                  productId={product.id}
                  className="bg-card/80 backdrop-blur-sm border border-border shadow-sm hover:bg-card h-11 w-11"
                  variant="outline"
                  size="icon"
                />
              </div>
            </div>

            <div className="px-1 pt-1 pb-0 space-y-1 bg-card rounded-t-2xl -mt-4 relative z-10 shadow-lg border-t border-x border-border">
              <div className="space-y-0.5">
                <h1 className="text-lg font-bold text-foreground leading-tight">
                  {product.title}
                </h1>
                <div className="flex items-center gap-2 text-xs">
                  <div className="flex items-center gap-1 text-yellow-600 font-bold">
                    <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                    <span>{avgRating ?? '—'}</span>
                  </div>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">
                    <ProductRatingLabel count={reviewsCount} />
                  </span>
                </div>
                <div className="flex items-end gap-2 pt-0.5">
                  <span className="text-xl font-bold text-foreground">
                    {formatPrice(price)} soʻm
                  </span>
                  {discountPercent != null && discountPercent > 0 && (
                    <Badge variant="destructive" className="mb-1 bg-red-100 text-red-600 border-red-200 text-[10px] px-1.5 h-4">
                      −{discountPercent}%
                    </Badge>
                  )}
                </div>
              </div>

              <Separator className="my-0.5" />

              <ProductVariantsSection isMobile />
              <Separator className="my-0.5" />

              <ProductSpecsSectionMobile product={product} />
              <Separator className="my-0.5" />

              {shop && (
                <>
                  <ProductShopCard shop={shop} productId={product.id} />
                  <Separator className="my-0.5" />
                </>
              )}

              {/* Блок отзывов — как в примере */}
              <div className="-mx-1 px-1 bg-muted py-1 pb-1">
                <ReviewsSection productId={product.id} initialReviews={reviews} />
              </div>
            </div>

            <ProductActionsSection isMobile />
          </div>

          </ProductSelectionProvider>

          {/* Похожие товары */}
          {product.category?.id && (
            <div className="px-1 lg:px-0 -mt-2 lg:mt-0 relative z-20">
              <RelatedProducts categoryId={product.category.id} currentProductId={product.id} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
