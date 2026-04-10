import type { UserRole } from '@prisma/client';

/** User attached to request after JwtStrategy.validate */
export type RequestAuthUser = {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  moderatorPermissions?: unknown;
  /** SELLER: own id; CASHIER: shop owner user id; others: null */
  effectiveSellerId: string | null;
  staffShopId: string | null;
};
