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

Admin yaratish (seed siz):

- **Variant 1 (tavsiya):** `.env` da `ADMIN_EMAIL` va `ADMIN_PASSWORD` ni belgilang. API ishga tushganda bu foydalanuvchi avtomatik yaratiladi yoki paroli yangilanadi, roli `ADMIN` boʻladi. Ixtiyoriy: `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME`.
- **Variant 2:** Seed orqali (admin + seller + maʼlumotlar): `pnpm --filter @myshopuz/api exec prisma db seed`
- **Variant 3 (dev):** Backend ishlaganda `NODE_ENV !== production` da `POST /auth/dev-reset-seed-users` chaqiring — `admin@myshop.uz` / `Admin123!` yaratiladi yoki paroli qayta oʻrnatiladi.

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
| `telegram_login_tokens` does not exist, 500 при «Telegram orqali kirish» | Migratsiyalar serverni bazaga qoʻllanmagan | Serverni (production) da: `cd apps/api && pnpm run prisma:migrate:deploy`. `DATABASE_URL` production bazaga yoʻnaltirilgan boʻlishi kerak. |
| `The column users.staff_shop_id does not exist` (API chiqmayapti) | Kod yangilangan, lekin PostgreSQL da kassir ustuni qoʻshilmagan | Loyihani yangilab, `cd apps/api && pnpm run prisma:migrate:deploy` (yoki ildizdan `pnpm db:migrate:deploy`). Migratsiya `20260411130000_users_staff_shop_id_hotfix` idempotent — mavjud bazaga xavfsiz. |
| `Order.stock_deducted_at` / `stock_deducted_at does not exist` | Buyurtmalar jadvalida POS ombor maydoni yoʻq | `pnpm db:migrate:deploy` — qoʻllanadi `20260411131000_orders_stock_deducted_at_hotfix` (`"Order"` jadvali). |
| `platform_settings.chat_with_seller_enabled` does not exist | Eski baza, tovar sahifasi `GET /products/:id` paytida 500 | `pnpm db:migrate:deploy` — `20260411132000_platform_settings_chat_with_seller_hotfix`. |
| `Failed to find Server Action`, `Cannot read properties of null (reading 'digest')` (Next.js web) | Eski build yoki keshlangan JS yangi serverni bilan mos emas | Serverni: `cd apps/web && rm -rf .next && pnpm build && pnpm start` (yoki processni qayta ishga tushiring). Har bir deploy dan keyin Node processni toʻliq qayta ishga tushiring. |
| API: `connect ETIMEDOUT` (IPv6 yoki 443) | Tashqi xizmatga (DB, Redis, Telegram va hokazo) ulanish vaqti tugadi | Tarmoq/firewall tekshiring; `DATABASE_URL` va boshqa URL larni IPv4 ga oʻzgartiring yoki serverni IPv4 orqali chiqishga majburlang. |
| `relation "orders" does not exist` (`20260411133000_perf_indexes`) | Eski migratsiya notoʻgʻri `orders` jadvaliga indeks qoʻshgan; loyihada buyurtmalar jadvali `"Order"` (squashed_init bilan mos) | Reponi yangilang (tuzatilgan `migration.sql`), keyin serverda: `cd apps/api && npx prisma migrate resolve --rolled-back 20260411133000_perf_indexes`, soʻng `pnpm db:migrate:deploy`. |
| Prisma `P3009` — failed migrations | Oldingi `migrate deploy` migratsiyani yarim qoʻllagan | Yuqoridagi `migrate resolve --rolled-back <migratsiya_nomi>`, bazani tuzating (kerak boʻlsa), keyin qayta `migrate deploy`. [Prisma qo‘llanmasi](https://www.prisma.io/docs/guides/migrate/troubleshooting-development) |

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

### Health va dev-endpointlar

- **Liveness:** `GET /health` — jarayon soʻrovlarni qabul qilmoqda.
- **Readiness:** `GET /health/ready` — PostgreSQL va (agar `REDIS_URL` berilgan boʻlsa) Redis `PING` tekshiriladi; monitoring / orchestrator uchun.
- **Har bir soʻrov:** javob sarlavhasida `x-request-id` (kiruvchi sarlavha boʻlsa saqlanadi, aks holda UUID).
- **Dev-only:** `POST /auth/dev-reset-seed-users` faqat production-ga oʻxshash muhitda oʻchiriladi: `NODE_ENV=production`, yoki `APP_ENV=production`, yoki `VERCEL_ENV=production`, yoki staging uchun `FORCE_DISABLE_DEV_ENDPOINTS=true`. Batafsil: `apps/api/.env.example`.

## CI/CD (Mercury / MyShopUZ)

GitHub Actions orqali avtomatik ishlaydi:

- **CI** (`.github/workflows/ci.yml`): har `push` / `pull_request` da `main` va `develop` uchun:
  - Loyiha ildizida `pnpm install --frozen-lockfile`
  - Prisma client generatsiya (`pnpm db:generate`)
  - `pnpm run lint` (API + Web)
  - `pnpm run build` (muhit o‘zgaruvchilari CI uchun berilgan)
  - `pnpm run test` (Turbo: avvalo workspace bogʻliqliklari `^build`, masalan `@myshopuz/shared`; toʻliq `next build` talab qilinmaydi — CI tezroq ishlaydi)

- **CD** (`.github/workflows/cd.yml`): `main` ga push qilinganda:
  - API uchun Docker image yig‘iladi va **GitHub Container Registry** (ghcr.io) ga push qilinadi.
  - Image: `ghcr.io/<owner>/myshopuz-api:latest` va `ghcr.io/<owner>/myshopuz-api:<short-sha>`.
  - **Avtomatik deploy:** Agar server SSH orqali tayyor bo‘lsa, `main` ga push qilganda image serverni yangilaydi (quyida).

### Avtomatik deploy (CD) — serverni sozlash

Deploy ishlashi uchun GitHub repo **Variables** va **Secrets** ni to‘ldiring, so‘ng **Variables** da `DEPLOY_ENABLED` = `true` qiling.

**Repository variables (Settings → Secrets and variables → Actions → Variables):**

| O‘zgaruvchi       | Tavsif                          | Masalan        |
|-------------------|----------------------------------|----------------|
| `DEPLOY_ENABLED`  | Deploy yoqish (true qilganda)    | `true`         |
| `DEPLOY_PATH`     | Serverni repo yo‘li (ixtiyoriy)  | `/opt/myshopuz`|

**Repository secrets (Settings → Secrets and variables → Actions → Secrets):**

| Secret             | Tavsif                                              |
|--------------------|-----------------------------------------------------|
| `SERVER_HOST`      | Server IP yoki domen (masalan 85.239.39.46)         |
| `SERVER_USERNAME`  | SSH foydalanuvchi (masalan root)                    |
| `SSH_PRIVATE_KEY`  | SSH kalit (private key to‘liq matni)               |
| `DEPLOY_PORT`      | SSH port (ixtiyoriy, sukutda 22)                   |
| `GHCR_TOKEN`       | GitHub PAT (read:packages) — image pull uchun      |
| `DATABASE_URL`     | PostgreSQL URL (serverni .env uchun)               |
| `JWT_SECRET`       | JWT kalit (serverni .env uchun)                   |
| `CORS_ORIGIN`, `REDIS_URL`, `TELEGRAM_BOT_TOKEN` va boshqalar | API sozlamalari (serverni .env uchun) |

**Serverda bir martalik:**

1. Docker va Docker Compose o‘rnatilgan bo‘lsin.
2. Repo klon qiling (yoki `DEPLOY_PATH` da bo‘lsin):  
   `git clone https://github.com/<owner>/<repo>.git /opt/myshopuz && cd /opt/myshopuz`
3. `DEPLOY_PATH` da `.env` yarating (masalan `docker-compose.deploy.yml` uchun):  
   `DATABASE_URL`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `REDIS_URL`, `DEPLOY_IMAGE=ghcr.io/<owner>/myshopuz-api:latest` va boshqa kerakli o‘zgaruvchilar.
4. Birinchi marta: `docker compose -f docker-compose.deploy.yml up -d` (DB/Redis/API ishga tushadi).

Keyingi `main` ga push lardan so‘ng workflow avtomatik: reponi yangilaydi, image ni pull qiladi va `docker compose up -d` bajaradi.

**Eslatma:** Web (Next.js) ni Vercel yoki boshqa platformaga ulaganingizda ular o‘zlari repodan build qiladi; API ni GHCR image dan yoki Railway/Render orqali deploy qilishingiz mumkin.

## Produktivlik va masshtab

- **Rate limit:** `THROTTLE_LIMIT_SHORT` (sukutda 300/daq), `THROTTLE_LIMIT_LONG` (sukutda 2000/kun). `REDIS_URL` bo‘lsa, limitlar barcha API replikalari uchun umumiy hisoblanadi.
- **PostgreSQL:** Yuqori yuklama uchun `DATABASE_URL` da `?connection_limit=20` (yoki ko‘proq) qo‘shing.
- **Redis:** `REDIS_URL` bo‘lsa — Throttler Redis da saqlanadi (replikalar uchun umumiy), bankerlar 1 daqiqa keshlanadi.
- **Gorizontal masshtab:** 2 ta API + Nginx: `docker compose -f docker-compose.scale.yml up -d`. Nginx 4000 portda, so‘rovlar api1 va api2 ga taqsimlanadi.

## Deploy

- **Frontend**: Vercel – `apps/web`, `NEXT_PUBLIC_API_URL` ni **https://** bilan oʻrnating
- **Backend**: Railway yoki VPS – Dockerfile ishlatiladi, `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` (https domen) kerak
- **Cloudflare**: DNS proxy va DDoS himoya; SSL/TLS rejimini “Full (strict)” qiling

### .env sozlash: domenda (masalan samarkand.site)

**API** (`apps/api/.env`):

```env
DATABASE_URL="postgresql://user:password@host:5432/myshopuz"
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_ACCESS_EXPIRES=15m
# Frontend domeni — CORS va cookie. Bir nechta bo'lsa vergul bilan
CORS_ORIGIN=https://samarkand.site,https://www.samarkand.site
CSRF_SECRET=your-csrf-secret-min-32-characters-for-production
# Frontend manzili: Telegram Web App va bildirishnomalardagi linklar
APP_URL=https://samarkand.site
TELEGRAM_BOT_TOKEN=123456789:ABC...
# Saytda «Telegram orqali kirish» tugmasi uchun — bot username (@ siz, masalan MyShopUZBot)
TELEGRAM_BOT_USERNAME=MyShopUZBot
# Qolgan (SMTP, Click, Payme, Cloudinary va boshqalar) — ixtiyoriy
```

**Web** (`apps/web/.env.local` yoki build ortidagi muhit):

```env
# API manzili. Agar API subdomenda bo'lsa:
NEXT_PUBLIC_API_URL=https://api.samarkand.site
# Sitemap va robots uchun asosiy sayt manzili
NEXT_PUBLIC_SITE_URL=https://samarkand.site
```

**Eslatma:** Agar API va Web bir domen ostida (masalan Nginx orqali) bo'lsa: Web `https://samarkand.site`, API `https://samarkand.site/api` — unda `NEXT_PUBLIC_API_URL=https://samarkand.site` qo'ying. Subdomen (api.samarkand.site) ishlatilsa — yuqoridagi kabi `NEXT_PUBLIC_API_URL=https://api.samarkand.site`.

## Test

```bash
# API
cd apps/api && pnpm test

# Web
cd apps/web && pnpm test
```

### Yuklama testi

API ga bosim o‘tkazish (API ishlab turgan bo‘lishi kerak):

```bash
# Node bilan oddiy test (100 so‘rov, 10 parallel)
node scripts/load-test.js

# yoki k6 o‘rnatib (https://k6.io):
# k6 run --vus 20 --duration 30s scripts/load-test-k6.js
```

## Litsenziya

Maxsus.
