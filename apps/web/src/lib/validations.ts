import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'Email kiriting').email('Notoʻgʻri email'),
  password: z.string().min(1, 'Parol kiriting'),
});

export const registerSchema = z.object({
  email: z.string().min(1, 'Email kiriting').email('Notoʻgʻri email'),
  password: z.string().min(8, 'Parol kamida 8 belgidan iborat boʻlishi kerak'),
  passwordConfirm: z.string(),
  firstName: z.string().min(1, 'Ism kiriting').max(100),
  lastName: z.string().min(1, 'Familiya kiriting').max(100),
}).refine((data) => data.password === data.passwordConfirm, {
  message: 'Parollar mos kelmadi',
  path: ['passwordConfirm'],
});

export const checkoutAddressSchema = z.object({
  city: z.string().max(200).optional(),
  district: z.string().max(200).optional(),
  street: z.string().max(500).optional(),
  house: z.string().max(50).optional(),
  phone: z.string().min(1, 'Telefon raqamini kiriting').max(50),
  email: z.string().max(320).optional(),
}).refine(
  (data) => !data.email || data.email === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email),
  { message: 'Notoʻgʻri email', path: ['email'] }
);

export function validateCheckoutAddress(
  data: { city?: string; street?: string; house?: string; phone?: string; deliveryType: string }
): { success: true } | { success: false; errors: string[] } {
  const errors: string[] = [];
  if (!data.phone?.trim()) errors.push('Telefon raqamini kiriting');
  if (data.deliveryType === 'DELIVERY') {
    if (!data.city?.trim()) errors.push('Shahar kiriting');
    if (!data.street?.trim()) errors.push('Koʻcha kiriting');
    if (!data.house?.trim()) errors.push('Uy raqami kiriting');
  }
  if (errors.length) return { success: false, errors };
  return { success: true };
}

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CheckoutAddressInput = z.infer<typeof checkoutAddressSchema>;
