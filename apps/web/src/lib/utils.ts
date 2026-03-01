import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Server: full API URL. Client: same-origin proxy to avoid "local network" permission. */
export const API_URL =
  typeof window === 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000')
    : '/api-proxy';

/** Формат цены: целое число без копеек, пробел — разделитель тысяч (без запятых). */
export function formatPrice(value: number): string {
  const n = Math.round(Number(value));
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Транслитерация кириллицы в латиницу для поиска (русский, узбекский и др.). */
export function transliterateCyrillicToLatin(text: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'j', з: 'z',
    и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 's', ч: 'ch', ш: 'sh', щ: 'sh',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
    А: 'A', Б: 'B', В: 'V', Г: 'G', Д: 'D', Е: 'E', Ё: 'E', Ж: 'K', З: 'Z',
    И: 'I', Й: 'Y', К: 'K', Л: 'L', М: 'M', Н: 'N', О: 'O', П: 'P', Р: 'R',
    С: 'S', Т: 'T', У: 'U', Ф: 'F', Х: 'H', Ц: 'S', Ч: 'Ch', Ш: 'Sh', Щ: 'Sh',
    Ъ: '', Ы: 'Y', Ь: '', Э: 'E', Ю: 'Yu', Я: 'Ya',
    ғ: "g'", қ: 'q', ҳ: 'h', ў: "o'",
    Ғ: "G'", Қ: 'Q', Ҳ: 'H', Ў: "O'",
  };
  return text.replace(/[\u0400-\u04FF]/g, (ch) => map[ch] ?? ch);
}
