# MyShopUZ – Markaz

Markaz (marketplace) loyihasi: xaridor, sotuvchi, administrator rollari.

## Texnologiyalar

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui (radix), Framer Motion
- **Backend**: NestJS, PostgreSQL, Prisma, Redis
- **Auth**: JWT (access 15 min, refresh 7 kun httpOnly cookie), bcrypt
- **Xavfsizlik**: Helmet, rate-limiting

## Loyiha tuzilishi (monorepo)

```
MyShopUZ/
├── apps/
│   ├── api/          # NestJS backend
│   └── web/          # Next.js frontend
├── packages/
│   └── shared/       # Umumiy tiplar va konstantalar
├── docker-compose.yml
└── package.json
```

## Ishga tushirish

### Talablar

- Node.js 20+, pnpm 9+
- PostgreSQL 16, Redis 7 (yoki Docker)

### 1. Oʻrnatish (loyiha ildizida)

```bash
pnpm install
```

**Muhim:** Avvalo loyiha ildizida `pnpm install` bajarilishi kerak, shundan keyin Prisma va boshqa buyruqlar ishlaydi.

### 2. Backend (API)

```bash
cd apps/api
copy .env.example .env
# .env da DATABASE_URL va JWT_SECRET ni toʻldiring
```

Keyin loyiha **ildizidan** (MyShopUZ):

```bash
pnpm db:migrate
# yoki: pnpm --filter @myshopuz/api run prisma:migrate
```

Yoki `apps/api` ichida:

```bash
pnpm run prisma:migrate
```

RLS: migrations dan keyin ixtiyoriy — `apps/api/prisma/rls-policies.sql` ni PostgreSQL da ishga tushiring.

Admin yaratish (ixtiyoriy):

```bash
pnpm --filter @myshopuz/api exec prisma db seed
```

Backend ishga tushirish:

```bash
cd apps/api
pnpm run dev
```

API: http://localhost:4000  
Swagger: http://localhost:4000/api/docs

### 3. Frontend (Web)

**Eng oson usul (tavsiya etiladi):** Loyiha **ildizidan** ikkala serverni bir vaqtda ishga tushiring:

```bash
# MyShopUZ ildizida (apps/api va apps/web yonida)
pnpm run dev
```

Bu buyruq API (4000) va Web (3000) ni bir vaqtda ishga tushiradi. Web avtomatik ravishda API porti ochilishini kutadi, keyin ishga tushadi. Veb: http://localhost:3000

Alohida ishga tushirish (kerak boʻlsa):

```bash
cd apps/web
cp .env.example .env.local
pnpm run dev
```

**Eslatma:** Web API ga soʻrov yuboradi (localhost:4000). Agar faqat Web ni ishga tushirsangiz, API ishlamasa brauzerda va terminalda `ECONNREFUSED 127.0.0.1:4000` xatoligi chiqadi. Buning oldini olish uchun ildizdan `pnpm run dev` ishlating yoki avval `cd apps/api && pnpm run dev` ni ishga tushiring.

### 4. Muammolarni bartaraf etish

| Xatolik | Sabab | Yechim |
|--------|--------|--------|
| `ECONNREFUSED 127.0.0.1:4000`, "Failed to proxy" | API (port 4000) ishlamayapti | Ildizdan `pnpm run dev` ishlating yoki boshqa terminalda `cd apps/api && pnpm run dev` ni ishga tushiring. |
| API ishga tushmayapti | PostgreSQL/Redis ulanishi yoki `.env` | `apps/api/.env` da `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` toʻgʻri ekanligini tekshiring. `pnpm db:migrate` bajarilgan boʻlishi kerak. |

### 5. Docker (lokal)

```bash
docker-compose up -d
```

### 6. Production rejimida ishga tushirish (ildizdan)

Avval ikkala ilovani build qiling, keyin ishga tushiring:

```bash
pnpm build
pnpm start
```

- **API:** http://localhost:4000 (yoki `PORT` da ko‘rsatilgan)
- **Web:** http://localhost:3000 (yoki `PORT` da ko‘rsatilgan)

`pnpm start` API va Web ni bir vaqtda ishga tushiradi. To‘xtatish: `Ctrl+C`.

### Telegram bot va Web App

API da Telegram bot (buyurtmalar, statistika, sotuvchi/admin bildirishnomalari) va **Web App** (mini-ilova) qo‘llab-quvvatlanadi. Sozlash: `apps/api/.env` da `TELEGRAM_BOT_TOKEN` va `APP_URL` (frontend manzili, masalan `https://myshop.uz`). Batafsil: `apps/api/TELEGRAM_BOT.md`. Web App ochiladi: `{APP_URL}/telegram-app` — bot menyusida «🛒 Do'kon (veb-ilova)» tugmasi orqali.

## Rollar

- **BUYER**: katalog, savatcha, buyurtma, toʻlov (Click, Payme, naqd, kartadan), sharhlar, chat
- **SELLER**: tovar CRUD, buyurtmalar, statistika, doʻkon sozlamalari, chat
- **ADMIN**: foydalanuvchilar, toifalar, moderatsiya, platforma sozlamalari, analitika

## Shifrlash va xavfsizlik (frontend ↔ backend)

- **Lokal (localhost):** Soʻrovlar HTTP orqali boradi — shifrlanish yoʻq, bu odatda rivojlantirish uchun qabul qilinadi.
- **Production:** Har doim HTTPS ishlating:
  - **Frontend:** Vercel avtomatik HTTPS beradi. `NEXT_PUBLIC_API_URL` ni **https://** bilan kiriting (masalan `https://api.myshop.uz`).
  - **Backend:** API ni HTTPS orqali xizmat qiladigan qilib sozlang:
    - **Railway / Render / Fly.io** kabi platformalar o‘zlari SSL beradi — domenni ulang.
    - **VPS:** Nginx yoki Caddy orqali SSL (masalan Let’s Encrypt) oling va API ni reverse proxy orqali https da oching.
  - **CORS:** `CORS_ORIGIN` da faqat https domenlaringizni ko‘rsating (masalan `https://myshop.uz`).
- **HSTS:** Production da API va Web ikkalasi ham HSTS header yuboradi (brauzer faqat HTTPS orqali ulanishni majburiy qiladi).

## Deploy

- **Frontend**: Vercel – `apps/web`, `NEXT_PUBLIC_API_URL` ni **https://** bilan oʻrnating
- **Backend**: Railway yoki VPS – Dockerfile ishlatiladi, `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` (https domen) kerak
- **Cloudflare**: DNS proxy va DDoS himoya; SSL/TLS rejimini “Full (strict)” qiling

## Test

```bash
# API
cd apps/api && pnpm test

# Web
cd apps/web && pnpm test
```

## Litsenziya

Maxsus.
