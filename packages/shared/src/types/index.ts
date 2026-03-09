export type UserRole = 'BUYER' | 'SELLER' | 'ADMIN' | 'ADMIN_MODERATOR';

/** Права модератора (только при role === ADMIN_MODERATOR). true = разрешено, false = запрещено. */
export interface ModeratorPermissions {
  canModerateProducts?: boolean;
  canModerateReviews?: boolean;
  canApproveSellerApplications?: boolean;
  canApproveShopUpdates?: boolean;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  isGuest?: boolean;
  moderatorPermissions?: ModeratorPermissions;
  iat?: number;
  exp?: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentMethod = 'CLICK' | 'PAYME' | 'CASH' | 'CARD_ON_DELIVERY';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
