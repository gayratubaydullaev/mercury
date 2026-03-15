import { createHmac } from 'crypto';

export function verifyTelegramWebAppInitData(initData: string, botToken: string): boolean {
  if (!initData?.trim() || !botToken) return false;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;
  params.delete('hash');
  const sortedKeys = [...params.keys()].sort();
  const dataCheckString = sortedKeys.map((k) => `${k}=${params.get(k)}`).join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return computedHash === hash;
}

export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export function parseTelegramUserFromInitData(initData: string): TelegramWebAppUser | null {
  const params = new URLSearchParams(initData);
  const userStr = params.get('user');
  if (!userStr) return null;
  try {
    const user = JSON.parse(decodeURIComponent(userStr)) as TelegramWebAppUser;
    if (typeof user?.id !== 'number' || !user.first_name) return null;
    return user;
  } catch {
    return null;
  }
}
