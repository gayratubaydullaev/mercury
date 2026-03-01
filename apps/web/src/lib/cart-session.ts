const CART_SESSION_KEY = 'cartSessionId';

export function getCartSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CART_SESSION_KEY);
}

export function setCartSessionId(sessionId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CART_SESSION_KEY, sessionId);
}

/** Headers to send with cart API requests (anonymous cart session). */
export function getCartHeaders(): Record<string, string> {
  const id = getCartSessionId();
  return id ? { 'x-cart-session': id } : {};
}

/** After a cart API response, save sessionId from body so next requests use the same cart. */
export function saveCartSessionFromResponse(data: { sessionId?: string | null } | null): void {
  if (data?.sessionId) setCartSessionId(data.sessionId);
}
