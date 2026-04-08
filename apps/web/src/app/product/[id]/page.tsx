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
import { ProductStockLabel } from './product-stock-label';
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
  const shop = product.shop;
  const stock = product.stock ?? 0;
  const reviews = (product.reviews as Array<{ id: string; rating: number; comment?: string | null; sellerReply?: string | null; createdAt?: string; user: { firstName: string; lastName: string } }>) ?? [];
  const reviewsCount = product.reviewsCount ?? reviews.length;
  const avgRating = product.avgRating ?? (reviews.length > 0
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : null);

  return (
    <div className="min-h-screen flex flex-col bg-muted/50 overflow-x-hidden">
      <main className="flex-1 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-12">
        <div className="w-full max-w-full min-w-0 px-4 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6">
          {/* Breadcrumb — только desktop (lg и выше) */}
          <div className="hidden lg:block">
            <ProductBreadcrumbs category={product.category} productTitle={product.title} />
          </div>

          {/* DESKTOP: 3 колонки; галерея с ограничением max-width — фото не растёт на больших экранах */}
          <ProductSelectionProvider product={{ ...product, stock: stock ?? 0 }}>
          <div className="hidden lg:grid lg:grid-cols-[minmax(320px,560px)_1fr_minmax(220px,300px)] gap-4 lg:gap-6 items-stretch min-w-0">
            {/* 1. Галерея — макс. ширина 560px */}
            <div className="bg-card rounded-2xl overflow-hidden shadow-sm border border-border w-full min-w-0 lg:self-start">
              <div className="h-full lg:h-auto w-full min-h-0 flex flex-col">
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
                      {formatPrice(price)} soʻm{product.unit ? ` / ${product.unit}` : ''}
                    </span>
                  </div>
                  {discountPercent != null && discountPercent > 0 && (
                    <div className="mb-1">
                      <span className="text-base text-muted-foreground line-through decoration-red-400 decoration-2">
                        {formatPrice(comparePrice ?? price)} soʻm{product.unit ? ` / ${product.unit}` : ''}
                      </span>
                      <Badge variant="destructive" className="ml-1.5 bg-red-100 text-red-600 hover:bg-red-200 border-red-200 text-[9px] px-1 h-3.5">
                        −{discountPercent}%
                      </Badge>
                    </div>
                  )}
                </div>
                <ProductStockLabel />
                <ProductActionsSection />
                {shop && (
                  <>
                    <Separator className="bg-border" />
                    <ProductShopCard shop={shop} productId={product.id} chatWithSellerEnabled={(product as { chatWithSellerEnabled?: boolean }).chatWithSellerEnabled !== false} />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Блок отзывов под сеткой — desktop */}
          <div className="hidden lg:block mt-12 mb-12">
            <ReviewsSection productId={product.id} />
          </div>

          {/* Мобильный и планшет: вертикальный layout, адаптивные отступы и safe area */}
          <div className="lg:hidden flex flex-col -mx-4 sm:mx-0 min-w-0">
            <div className="relative w-full">
              <Link
                href="/catalog"
                className="absolute top-[max(1rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))] z-20 flex items-center justify-center bg-card/90 backdrop-blur-sm border border-border shadow-sm hover:bg-card min-w-[44px] min-h-[44px] w-11 h-11 rounded-full text-foreground active:scale-95 transition-all touch-manipulation"
                aria-label="Orqaga"
              >
                <ChevronLeft className="w-6 h-6 shrink-0" />
              </Link>
              <MobileProductGalleryWithVariant
                product={product}
                productName={product.title}
              />
              <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-20 flex gap-2">
                <FavoriteButton
                  productId={product.id}
                  className="bg-card/90 backdrop-blur-sm border border-border shadow-sm hover:bg-card min-w-[44px] min-h-[44px] h-11 w-11 touch-manipulation"
                />
                <ProductShareBtn
                  productName={product.title}
                  productId={product.id}
                  className="bg-card/90 backdrop-blur-sm border border-border shadow-sm hover:bg-card min-w-[44px] min-h-[44px] h-11 w-11 touch-manipulation"
                  variant="outline"
                  size="icon"
                />
              </div>
            </div>

            <div className="px-2 sm:px-4 pt-3 sm:pt-5 pb-3 sm:pb-6 space-y-2 sm:space-y-3 bg-card rounded-t-2xl -mt-4 relative z-10 shadow-lg border-t border-x border-border">
              <div className="space-y-1 sm:space-y-1.5">
                <h1 className="text-base sm:text-lg font-bold text-foreground leading-tight pr-2">
                  {product.title}
                </h1>
                <div className="flex items-center gap-2 text-xs sm:text-sm flex-wrap">
                  <div className="flex items-center gap-1 text-yellow-600 font-bold">
                    <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-yellow-400 text-yellow-400 shrink-0" />
                    <span>{avgRating ?? '—'}</span>
                  </div>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">
                    <ProductRatingLabel count={reviewsCount} />
                  </span>
                </div>
                <div className="flex items-end gap-2 pt-0.5 sm:pt-1 flex-wrap">
                  <span className="text-lg sm:text-xl font-bold text-foreground">
                    {formatPrice(price)} soʻm{product.unit ? ` / ${product.unit}` : ''}
                  </span>
                  {discountPercent != null && discountPercent > 0 && (
                    <Badge variant="destructive" className="mb-0.5 bg-red-100 text-red-600 border-red-200 text-[10px] sm:text-xs px-1.5 h-4 sm:h-5">
                      −{discountPercent}%
                    </Badge>
                  )}
                </div>
                <ProductStockLabel />
              </div>

              <Separator className="my-1 sm:my-2" />

              <ProductVariantsSection isMobile />
              <Separator className="my-1 sm:my-2" />

              <ProductSpecsSectionMobile product={product} />
              <Separator className="my-1 sm:my-2" />

              {shop && (
                <>
                  <ProductShopCard shop={shop} productId={product.id} chatWithSellerEnabled={(product as { chatWithSellerEnabled?: boolean }).chatWithSellerEnabled !== false} />
                  <Separator className="my-1 sm:my-2" />
                </>
              )}

              <div className="-mx-2 sm:-mx-4 px-2 sm:px-4 bg-muted/50 py-3 sm:py-5 rounded-lg">
                <ReviewsSection productId={product.id} initialReviews={reviews} />
              </div>
            </div>

            <ProductActionsSection isMobile />
          </div>

          </ProductSelectionProvider>

          {/* Похожие товары — на мобильном без отступов от краёв экрана, как на главной */}
          {product.category?.id && (
            <div className="-mx-4 lg:mx-0 -mt-2 lg:mt-0 relative z-20">
              <RelatedProducts categoryId={product.category.id} currentProductId={product.id} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
