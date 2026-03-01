import { apiFetch } from './api';

/** Error with optional HTTP status (e.g. from swrFetcher). */
export interface FetchError extends Error {
  status?: number;
}

/**
 * Fetcher for SWR: GET request via apiFetch, returns JSON.
 * Use for catalog, product, cart, profile etc. to get caching and deduplication.
 */
export async function swrFetcher<T = unknown>(url: string): Promise<T> {
  const res = await apiFetch(url);
  if (!res.ok) {
    const err = new Error(res.statusText || 'Request failed') as FetchError;
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}
