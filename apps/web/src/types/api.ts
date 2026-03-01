import type { ProductCardProduct } from '@/components/product/product-card';

/** Paginated API response. */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** API product shape (price/comparePrice may be number from JSON). */
export interface ApiProduct {
  id: string;
  title: string;
  slug: string;
  price: string | number;
  comparePrice?: string | number | null;
  stock?: number;
  unit?: string | null;
  images: { url: string }[];
  shop?: { name?: string; slug: string };
  createdAt?: string;
  options?: Record<string, string[]> | null;
  avgRating?: number | null;
  reviewsCount?: number;
}

/** Standard API error body. */
export interface ApiError {
  message?: string;
  statusCode?: number;
  error?: string;
}

/** Type guard for API error body. */
export function isApiError(body: unknown): body is ApiError {
  return (
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    (typeof (body as ApiError).message === 'string' || (body as ApiError).message === undefined)
  );
}

/** Extract error message from response body (or status text). */
export function getApiErrorMessage(res: Response, body?: unknown): string {
  if (isApiError(body) && body.message) return body.message;
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const m = (body as { message: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return res.statusText || 'Request failed';
}

/** Map API product to ProductCardProduct (single source of truth). */
export function apiProductToCardProduct(p: ApiProduct): ProductCardProduct {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug ?? p.id,
    price: String(p.price),
    comparePrice: p.comparePrice != null ? String(p.comparePrice) : null,
    stock: p.stock,
    unit: p.unit ?? undefined,
    images: p.images ?? [],
    shop: p.shop,
    createdAt: p.createdAt,
    options: p.options ?? undefined,
    avgRating: p.avgRating ?? null,
    reviewsCount: p.reviewsCount ?? 0,
  };
}
