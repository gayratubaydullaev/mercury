import { API_URL } from './utils';
import { getCartHeaders } from './cart-session';

let csrfTokenPromise: Promise<string> | null = null;

/** Get CSRF token (cached). Call with credentials so the server sets the cookie. */
export async function getCsrfToken(): Promise<string> {
  if (typeof window === 'undefined') return '';
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetch(`${API_URL}/auth/csrf`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { csrfToken?: string }) => data.csrfToken ?? '')
      .catch(() => '');
  }
  return csrfTokenPromise;
}

/** Reset CSRF cache (e.g. after 403 to force refetch). */
export function clearCsrfCache(): void {
  csrfTokenPromise = null;
}

const MUTATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const ACCESS_TOKEN_KEY = 'accessToken';

/**
 * Try to refresh access token using httpOnly refresh cookie. Updates localStorage and dispatches auth-change.
 */
async function tryRefreshToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const res = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
  if (!res.ok) return null;
  const data = (await res.json()) as { accessToken?: string };
  if (!data?.accessToken) return null;
  localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
  window.dispatchEvent(new Event('auth-change'));
  return data.accessToken;
}

/**
 * Fetch wrapper: adds credentials, cart session headers, and for POST/PUT/PATCH/DELETE
 * adds x-csrf-token. On 403, clears CSRF cache and retries once. On 401, tries refresh and retries once.
 */
export async function apiFetch(
  url: string,
  init?: RequestInit,
  retried = false
): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const headers = new Headers(init?.headers);
  headers.set('Accept', headers.get('Accept') ?? 'application/json');
  if (!headers.has('Content-Type') && (init?.body !== undefined)) {
    headers.set('Content-Type', 'application/json');
  }
  const cart = getCartHeaders();
  Object.entries(cart).forEach(([k, v]) => headers.set(k, v));

  if (MUTATION_METHODS.includes(method) && typeof window !== 'undefined') {
    const token = await getCsrfToken();
    if (token) headers.set('x-csrf-token', token);
  }

  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (res.status === 401 && !retried && typeof window !== 'undefined') {
    const newToken = await tryRefreshToken();
    if (newToken) {
      const newHeaders = new Headers(init?.headers);
      newHeaders.set('Authorization', `Bearer ${newToken}`);
      return apiFetch(url, { ...init, headers: newHeaders }, true);
    }
  }

  if (res.status === 403 && !retried && MUTATION_METHODS.includes(method) && typeof window !== 'undefined') {
    clearCsrfCache();
    await getCsrfToken();
    return apiFetch(url, init, true);
  }

  return res;
}

/**
 * GET request via apiFetch, returns parsed JSON with type T.
 * Use for typed API responses instead of apiFetch(url).then(r => r.json()).
 */
export async function apiGetJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, init);
  return res.json() as Promise<T>;
}
