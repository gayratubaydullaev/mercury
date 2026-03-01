const GUEST_FAVORITES_KEY = 'guestFavorites';

/** Список ID товаров в избранном у гостя (localStorage). */
export function getGuestFavoriteIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GUEST_FAVORITES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function isGuestFavorite(productId: string): boolean {
  return getGuestFavoriteIds().includes(productId);
}

export function addGuestFavorite(productId: string): void {
  if (typeof window === 'undefined') return;
  const ids = getGuestFavoriteIds();
  if (ids.includes(productId)) return;
  ids.push(productId);
  localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent('guest-favorites-changed'));
}

export function removeGuestFavorite(productId: string): void {
  if (typeof window === 'undefined') return;
  const ids = getGuestFavoriteIds().filter((id) => id !== productId);
  localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent('guest-favorites-changed'));
}

export function toggleGuestFavorite(productId: string): boolean {
  const ids = getGuestFavoriteIds();
  const inFav = ids.includes(productId);
  if (inFav) removeGuestFavorite(productId);
  else addGuestFavorite(productId);
  return !inFav;
}
