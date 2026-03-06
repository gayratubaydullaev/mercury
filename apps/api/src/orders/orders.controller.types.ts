export interface OrdersControllerCreateResponse {
  orders: unknown[];
  guestAuth?: {
    accessToken: string;
    expiresAt: Date;
    user: { id: string; email: string; role: string; isGuest?: boolean };
  };
}
