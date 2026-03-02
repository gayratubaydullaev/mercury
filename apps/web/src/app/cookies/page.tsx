import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: "Cookie (kuki) siyosati",
  description: "MyShopUZ saytida cookie foydalanishi haqida ma\u2019lumot.",
};

export default function CookiesPage() {
  return (
    <div className="w-full container max-w-3xl mx-auto px-0 sm:px-4 md:px-6 py-8 md:py-12">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Cookie (kuki) siyosati</h1>
      <p className="text-muted-foreground text-sm mb-8">
        Oxirgi yangilanish: {new Date().toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-muted-foreground text-sm md:text-base">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">Cookie nima?</h2>
          <p>
            Cookie (kuki) — sayt tomonidan brauzeringizga yoziladigan kichik matn fayllari. Ular saytning
            to\u2019g\u2019ri ishlashi, xavfsizligi va sizning qulayligingiz uchun ishlatiladi.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">MyShopUZ qanday cookie ishlatadi?</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Savatcha (cart)</strong> — siz saytda qo\u2019shgan mahsulotlar savatchada saqlanadi (anonim
              foydalanuvchilar uchun sessiya identifikatori cookie orqali).
            </li>
            <li>
              <strong>Tizimga kirish (auth)</strong> — tizimga kiringan holatda sizni tanlash va yangilanish
              tokenini xavfsiz saqlash uchun (masalan, refreshToken).
            </li>
            <li>
              <strong>Xavfsizlik (CSRF)</strong> — so\u2019rovlarni soxta saytlardan himoya qilish uchun token
              cookie orqali yuboriladi.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">Cookie\u2019ni o\u2019chirish va boshqarish</h2>
          <p>
            Brauzeringiz sozlamalarida cookie\u2019larni o\u2019chirish yoki cheklash mumkin. Agar cookie\u2019lar o\u2019chirilsa,
            savatcha (anonim rejimda), avtomatik kirish va ba\u2019zi xavfsizlik funksiyalari to\u2019liq ishlamasligi
            mumkin.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">Savollar</h2>
          <p>
            Cookie siyosati yoki shaxsiy ma\u2019lumotlar bo\u2019yicha savollaringiz bo\u2019lsa,{' '}
            <Link href="/" className="text-primary underline underline-offset-4 hover:no-underline">
              Aloqa
            </Link>{' '}
            bo\u2019limi orqali murojaat qiling.
          </p>
        </section>
      </div>

      <p className="mt-10">
        <Link href="/" className="text-primary text-sm font-medium hover:underline">
          ← Bosh sahifaga
        </Link>
      </p>
    </div>
  );
}
