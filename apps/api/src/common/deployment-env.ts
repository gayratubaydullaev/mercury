/**
 * Production-like runtime: used to disable dev-only HTTP surface even if NODE_ENV is mis-set.
 * Set FORCE_DISABLE_DEV_ENDPOINTS=true on staging to block dev routes regardless of NODE_ENV.
 */
export function isProductionLike(): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  const appEnv = (process.env.APP_ENV ?? '').toLowerCase();
  if (appEnv === 'production') return true;
  if ((process.env.VERCEL_ENV ?? '').toLowerCase() === 'production') return true;
  if (process.env.FORCE_DISABLE_DEV_ENDPOINTS === 'true') return true;
  return false;
}
