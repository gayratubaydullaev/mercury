import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop';

async function main() {
  const adminHash = await bcrypt.hash('Admin123!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@myshop.uz' },
    update: { passwordHash: adminHash, role: 'ADMIN' },
    create: {
      email: 'admin@myshop.uz',
      passwordHash: adminHash,
      firstName: 'Admin',
      lastName: 'MyShop',
      role: 'ADMIN',
      emailVerified: true,
    },
  });
  console.log('Admin created/updated:', admin.email);

  const sellerHash = await bcrypt.hash('Seller123!', 10);
  const seller = await prisma.user.upsert({
    where: { email: 'seller@myshop.uz' },
    update: { passwordHash: sellerHash, role: 'SELLER' },
    create: {
      email: 'seller@myshop.uz',
      passwordHash: sellerHash,
      firstName: 'Sotuvchi',
      lastName: 'Do\'kon',
      role: 'SELLER',
      emailVerified: true,
    },
  });
  console.log('Seller created/updated:', seller.email);

  const existingSettings = await prisma.platformSettings.findFirst();
  if (!existingSettings) {
    await prisma.platformSettings.create({
      data: { commissionRate: 5, minPayoutAmount: 100000 },
    });
    console.log('Platform settings created');
  }

  // Родительские категории (без parentId)
  const parentCats = await Promise.all([
    prisma.category.upsert({ where: { slug: 'elektronika' }, update: {}, create: { name: 'Elektronika', slug: 'elektronika', description: 'Telefonlar, planshetlar, kompyuterlar' } }),
    prisma.category.upsert({ where: { slug: 'kiyim' }, update: {}, create: { name: 'Kiyim', slug: 'kiyim', description: 'Erkaklar va ayollar kiyimi' } }),
    prisma.category.upsert({ where: { slug: 'oziq-ovqat' }, update: {}, create: { name: 'Oziq-ovqat', slug: 'oziq-ovqat', description: 'Oziq-ovqat mahsulotlari' } }),
    prisma.category.upsert({ where: { slug: 'uy-rozigari' }, update: {}, create: { name: 'Uy ro\'zigari', slug: 'uy-rozigari', description: 'Uy uchun buyumlar' } }),
  ]);
  const parentBySlug = Object.fromEntries(parentCats.map((c) => [c.slug, c.id]));

  // Подкатегории (parent_id задан) — товары только в подкатегориях, чтобы попадали на главную (random)
  const subcatData: Array<{ name: string; slug: string; parentSlug: string }> = [
    { name: 'Telefonlar', slug: 'elektronika-telefonlar', parentSlug: 'elektronika' },
    { name: 'Noutbuklar', slug: 'elektronika-noutbuklar', parentSlug: 'elektronika' },
    { name: 'Aksessuarlar', slug: 'elektronika-aksessuarlar', parentSlug: 'elektronika' },
    { name: 'Erkaklar kiyimi', slug: 'kiyim-erkaklar', parentSlug: 'kiyim' },
    { name: 'Ayollar kiyimi', slug: 'kiyim-ayollar', parentSlug: 'kiyim' },
    { name: 'Asal va shirinliklar', slug: 'oziq-ovqat-asal', parentSlug: 'oziq-ovqat' },
    { name: 'Non va sut mahsulotlari', slug: 'oziq-ovqat-non', parentSlug: 'oziq-ovqat' },
    { name: 'Ichimliklar', slug: 'oziq-ovqat-ichimliklar', parentSlug: 'oziq-ovqat' },
    { name: 'Choy va qahva', slug: 'oziq-ovqat-choy', parentSlug: 'oziq-ovqat' },
    { name: 'Idishlar', slug: 'uy-rozigari-idishlar', parentSlug: 'uy-rozigari' },
    { name: 'Yoritgichlar', slug: 'uy-rozigari-yoritgichlar', parentSlug: 'uy-rozigari' },
  ];
  const subcategories = await Promise.all(
    subcatData.map((s) =>
      prisma.category.upsert({
        where: { slug: s.slug },
        update: { parentId: parentBySlug[s.parentSlug]! },
        create: { name: s.name, slug: s.slug, parentId: parentBySlug[s.parentSlug]! },
      })
    )
  );
  const categories = [...parentCats, ...subcategories];
  console.log('Categories:', categories.length, '(parents:', parentCats.length, ', subcategories:', subcategories.length, ')');

  let shop = await prisma.shop.findFirst({ where: { userId: seller.id } });
  if (!shop) {
    shop = await prisma.shop.create({
      data: {
        name: 'Asal Do\'koni',
        slug: 'asal-dokoni',
        description: 'Ishonchli sotuvchi',
        userId: seller.id,
      },
    });
    console.log('Shop created:', shop.name);
  }

  // categorySlug — слаг подкатегории (товары только в подкатегориях, чтобы отображались на главной)
  const productData: Array<{
    title: string;
    slug: string;
    description: string;
    price: number;
    comparePrice?: number;
    stock: number;
    sku?: string;
    categorySlug: string;
    options?: Record<string, string[]>;
  }> = [
    { title: 'Smartfon Samsung A54', slug: 'samsung-a54', description: '5G, 128GB, qora', price: 4500000, comparePrice: 4990000, stock: 15, sku: 'SAM-A54-128', categorySlug: 'elektronika-telefonlar', options: { Rang: ['Qora', 'Binafsha', 'Yashil'], Xotira: ['128GB', '256GB'] } },
    { title: 'Noutbuk HP 15', slug: 'hp-15', description: 'Intel i5, 8GB RAM, 256GB SSD', price: 8500000, stock: 5, categorySlug: 'elektronika-noutbuklar' },
    { title: 'Quloqchinlar AirPods', slug: 'airpods', description: 'Bluetooth 5.0, oq', price: 1200000, stock: 30, categorySlug: 'elektronika-aksessuarlar', options: { Rang: ['Oq', 'Qora'] } },
    { title: 'Futbolka erkaklar uchun', slug: 'futbolka-erkak', description: '100% paxta, M, L, XL', price: 85000, stock: 100, categorySlug: 'kiyim-erkaklar', options: { "O'lcham": ['M', 'L', 'XL'], Rang: ['Oq', 'Qora', 'Ko\'k'] } },
    { title: 'Shim yengil', slug: 'shim-yengil', description: 'Dins stil', price: 180000, stock: 40, categorySlug: 'kiyim-erkaklar', options: { "O'lcham": ['28', '30', '32', '34'], Rang: ['Ko\'k', 'Qora'] } },
    { title: 'Ko\'ylak ofis', slug: 'koylak-ofis', description: 'Erkaklar ofis ko\'ylagi', price: 220000, stock: 25, categorySlug: 'kiyim-erkaklar', options: { "O'lcham": ['M', 'L', 'XL'] } },
    { title: 'Asal 1 kg', slug: 'asal-1kg', description: 'Tabiiy tog\' asali', price: 120000, stock: 50, categorySlug: 'oziq-ovqat-asal' },
    { title: 'Non to\'rtlik', slug: 'non-tortlik', description: 'Xonaki non', price: 8000, stock: 200, categorySlug: 'oziq-ovqat-non' },
    { title: 'Suv 1.5L', slug: 'suv-15l', description: 'Tarkibiy suv', price: 3000, stock: 500, categorySlug: 'oziq-ovqat-ichimliklar' },
    { title: 'Choy qora 100g', slug: 'choy-qora', description: 'O\'zbekiston choyi', price: 25000, stock: 80, categorySlug: 'oziq-ovqat-choy', options: { Hajm: ['100g', '200g'] } },
    { title: 'Idish to\'plami 12 dona', slug: 'idish-toplami', description: 'Keramika, 12 dona', price: 350000, stock: 20, categorySlug: 'uy-rozigari-idishlar' },
    { title: 'Lampa stol', slug: 'lampa-stol', description: 'LED, 3 rejim', price: 95000, stock: 35, categorySlug: 'uy-rozigari-yoritgichlar', options: { Rang: ['Oq', 'Qora', 'Kumush'] } },
    { title: 'Soat qo\'l', slug: 'soat-qol', description: 'Erkaklar kvars soati', price: 280000, stock: 15, categorySlug: 'elektronika-aksessuarlar', options: { Rang: ['Qora', 'Kumush', 'Oltin'] } },
    { title: 'Sumka sport', slug: 'sumka-sport', description: 'Sport sumkasi, 30L', price: 150000, stock: 40, categorySlug: 'kiyim-erkaklar' },
    { title: 'Shokolad 100g', slug: 'shokolad-100', description: 'Sutli shokolad', price: 18000, stock: 120, categorySlug: 'oziq-ovqat-asal' },
  ];

  const catBySlug = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

  for (const p of productData) {
    const categoryId = catBySlug[p.categorySlug];
    if (!categoryId) continue;
    const existing = await prisma.product.findFirst({ where: { slug: p.slug, shopId: shop!.id } });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: { title: p.title, description: p.description, price: p.price, comparePrice: p.comparePrice ?? null, stock: p.stock, sku: p.sku ?? null, options: p.options ?? undefined, categoryId },
      });
    } else {
      await prisma.product.create({
        data: {
          title: p.title,
          slug: p.slug,
          description: p.description,
          price: p.price,
          comparePrice: p.comparePrice,
          stock: p.stock,
          sku: p.sku,
          categoryId,
          shopId: shop!.id,
          isModerated: true,
          options: p.options ?? undefined,
          images: {
            create: [{ url: PLACEHOLDER_IMAGE, sortOrder: 0 }],
          },
        },
      });
    }
  }
  console.log('Products seeded:', productData.length);

  // Тестовые товары с 4–5 фото и вариантами; товары с опциями без вариантов — по 1 фото и варианты по всем комбинациям
  const richProductSlugs = ['samsung-a54', 'airpods', 'futbolka-erkak', 'hp-15', 'lampa-stol', 'shim-yengil', 'koylak-ofis', 'choy-qora', 'soat-qol'];
  const richImages: Record<string, { url: string; alt?: string }[]> = {
    'samsung-a54': [
      { url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=800&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1592286927505-d0d5c2e6e0c4?w=800&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1605236453806-6ff36851218e?w=800&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=800&fit=crop' },
    ],
    airpods: [
      { url: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=800&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1598331668826-20cecc596b86?w=800&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1612444530582-fc66183b16f7?w=800&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1588423771073-b8903fbb85b5?w=800&fit=crop' },
    ],
    'futbolka-erkak': [
      { url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=800&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=800&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800&fit=crop' },
    ],
    'hp-15': [
      { url: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=800&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=800&fit=crop' },
    ],
    'lampa-stol': [
      { url: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=800&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&fit=crop' },
    ],
    'shim-yengil': [{ url: PLACEHOLDER_IMAGE }],
    'koylak-ofis': [{ url: PLACEHOLDER_IMAGE }],
    'choy-qora': [{ url: PLACEHOLDER_IMAGE }],
    'soat-qol': [{ url: PLACEHOLDER_IMAGE }],
  };
  const richProductOptions: Record<string, Record<string, string[]>> = {
    'samsung-a54': { Rang: ['Qora', 'Binafsha', 'Yashil'], Xotira: ['128GB', '256GB'] },
    airpods: { Rang: ['Oq', 'Qora'] },
    'futbolka-erkak': { "O'lcham": ['M', 'L', 'XL'], Rang: ['Oq', 'Qora', "Ko'k"] },
    'hp-15': { Rang: ['Kumush', 'Qora'] },
    'lampa-stol': { Rang: ['Oq', 'Qora', 'Kumush'] },
    'shim-yengil': { "O'lcham": ['28', '30', '32', '34'], Rang: ["Ko'k", 'Qora'] },
    'koylak-ofis': { "O'lcham": ['M', 'L', 'XL'] },
    'choy-qora': { Hajm: ['100g', '200g'] },
    'soat-qol': { Rang: ['Qora', 'Kumush', 'Oltin'] },
  };
  const richVariants: Record<string, { options: Record<string, string>; stock: number; imageUrl?: string; sku: string; priceOverride?: number }[]> = {
    'samsung-a54': [
      { options: { Rang: 'Qora', Xotira: '128GB' }, stock: 3, sku: 'SAM-A54-128-BLK' },
      { options: { Rang: 'Qora', Xotira: '256GB' }, stock: 2, sku: 'SAM-A54-256-BLK', priceOverride: 4990000 },
      { options: { Rang: 'Binafsha', Xotira: '128GB' }, stock: 2, sku: 'SAM-A54-128-VIO', imageUrl: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=400&fit=crop' },
      { options: { Rang: 'Binafsha', Xotira: '256GB' }, stock: 2, sku: 'SAM-A54-256-VIO', priceOverride: 4990000 },
      { options: { Rang: 'Yashil', Xotira: '128GB' }, stock: 3, sku: 'SAM-A54-128-GRN' },
      { options: { Rang: 'Yashil', Xotira: '256GB' }, stock: 3, sku: 'SAM-A54-256-GRN', priceOverride: 4990000 },
    ],
    airpods: [
      { options: { Rang: 'Oq' }, stock: 20, sku: 'AP-WHT' },
      { options: { Rang: 'Qora' }, stock: 15, sku: 'AP-BLK', imageUrl: 'https://images.unsplash.com/photo-1598331668826-20cecc596b86?w=400&fit=crop' },
    ],
    'futbolka-erkak': [
      { options: { "O'lcham": 'M', Rang: 'Oq' }, stock: 25, sku: 'TEE-M-WHT' },
      { options: { "O'lcham": 'M', Rang: 'Qora' }, stock: 30, sku: 'TEE-M-BLK' },
      { options: { "O'lcham": 'M', Rang: "Ko'k" }, stock: 22, sku: 'TEE-M-BLU' },
      { options: { "O'lcham": 'L', Rang: 'Oq' }, stock: 20, sku: 'TEE-L-WHT' },
      { options: { "O'lcham": 'L', Rang: 'Qora' }, stock: 24, sku: 'TEE-L-BLK' },
      { options: { "O'lcham": 'L', Rang: "Ko'k" }, stock: 18, sku: 'TEE-L-BLU' },
      { options: { "O'lcham": 'XL', Rang: 'Oq' }, stock: 14, sku: 'TEE-XL-WHT' },
      { options: { "O'lcham": 'XL', Rang: 'Qora' }, stock: 12, sku: 'TEE-XL-BLK' },
      { options: { "O'lcham": 'XL', Rang: "Ko'k" }, stock: 10, sku: 'TEE-XL-BLU' },
    ],
    'hp-15': [
      { options: { Rang: 'Kumush' }, stock: 4, sku: 'HP15-SLV' },
      { options: { Rang: 'Qora' }, stock: 3, sku: 'HP15-BLK' },
    ],
    'lampa-stol': [
      { options: { Rang: 'Oq' }, stock: 12, sku: 'LAMP-WHT' },
      { options: { Rang: 'Qora' }, stock: 10, sku: 'LAMP-BLK' },
      { options: { Rang: 'Kumush' }, stock: 8, sku: 'LAMP-SLV' },
    ],
    'shim-yengil': [
      { options: { "O'lcham": '28', Rang: "Ko'k" }, stock: 5, sku: 'SHIM-28-BLU' },
      { options: { "O'lcham": '28', Rang: 'Qora' }, stock: 5, sku: 'SHIM-28-BLK' },
      { options: { "O'lcham": '30', Rang: "Ko'k" }, stock: 10, sku: 'SHIM-30-BLU' },
      { options: { "O'lcham": '30', Rang: 'Qora' }, stock: 10, sku: 'SHIM-30-BLK' },
      { options: { "O'lcham": '32', Rang: "Ko'k" }, stock: 5, sku: 'SHIM-32-BLU' },
      { options: { "O'lcham": '32', Rang: 'Qora' }, stock: 5, sku: 'SHIM-32-BLK' },
      { options: { "O'lcham": '34', Rang: "Ko'k" }, stock: 5, sku: 'SHIM-34-BLU' },
      { options: { "O'lcham": '34', Rang: 'Qora' }, stock: 5, sku: 'SHIM-34-BLK' },
    ],
    'koylak-ofis': [
      { options: { "O'lcham": 'M' }, stock: 10, sku: 'KOYL-M' },
      { options: { "O'lcham": 'L' }, stock: 8, sku: 'KOYL-L' },
      { options: { "O'lcham": 'XL' }, stock: 7, sku: 'KOYL-XL' },
    ],
    'choy-qora': [
      { options: { Hajm: '100g' }, stock: 50, sku: 'CHOY-100' },
      { options: { Hajm: '200g' }, stock: 30, sku: 'CHOY-200' },
    ],
    'soat-qol': [
      { options: { Rang: 'Qora' }, stock: 6, sku: 'SOAT-BLK' },
      { options: { Rang: 'Kumush' }, stock: 5, sku: 'SOAT-SLV' },
      { options: { Rang: 'Oltin' }, stock: 4, sku: 'SOAT-GLD' },
    ],
  };

  for (const slug of richProductSlugs) {
    const product = await prisma.product.findFirst({ where: { slug, shopId: shop!.id }, include: { images: true, variants: true } });
    const imgs = richImages[slug];
    const vars = richVariants[slug];
    if (!imgs?.length || !vars?.length) continue;
    if (product) {
      await prisma.productImage.deleteMany({ where: { productId: product.id } });
      await prisma.productVariant.deleteMany({ where: { productId: product.id } });
      await prisma.productImage.createMany({
        data: imgs.map((img, i) => ({ productId: product.id, url: img.url, alt: img.alt ?? null, sortOrder: i })),
      });
      const totalStock = vars.reduce((s, v) => s + v.stock, 0);
      const productOptions = richProductOptions[slug];
      await prisma.product.update({
        where: { id: product.id },
        data: { stock: totalStock, ...(productOptions && { options: productOptions }) },
      });
      for (const v of vars) {
        await prisma.productVariant.create({
          data: {
            productId: product.id,
            options: v.options,
            stock: v.stock,
            imageUrl: v.imageUrl ?? null,
            sku: v.sku,
            priceOverride: v.priceOverride ?? null,
          },
        });
      }
      console.log('Rich product updated:', slug, 'images:', imgs.length, 'variants:', vars.length);
    } else {
      const catId = catBySlug['elektronika-telefonlar'] ?? catBySlug['elektronika-noutbuklar'] ?? catBySlug['kiyim-erkaklar'] ?? catBySlug['uy-rozigari-yoritgichlar'];
      if (!catId) continue;
      const base = productData.find((p) => p.slug === slug);
      const totalStock = vars.reduce((s, v) => s + v.stock, 0);
      const productOptions = richProductOptions[slug];
      const created = await prisma.product.create({
        data: {
          title: base?.title ?? slug,
          slug,
          description: base?.description ?? '',
          price: base?.price ?? 100000,
          comparePrice: base?.comparePrice ?? null,
          stock: totalStock,
          sku: base?.sku ?? null,
          categoryId: catId,
          shopId: shop!.id,
          isModerated: true,
          options: productOptions ?? base?.options ?? undefined,
          images: {
            create: imgs.map((img, i) => ({ url: img.url, alt: img.alt ?? null, sortOrder: i })),
          },
        },
      });
      for (const v of vars) {
        await prisma.productVariant.create({
          data: {
            productId: created.id,
            options: v.options,
            stock: v.stock,
            imageUrl: v.imageUrl ?? null,
            sku: v.sku,
            priceOverride: v.priceOverride ?? null,
          },
        });
      }
      console.log('Rich product created:', slug, 'images:', imgs.length, 'variants:', vars.length);
    }
  }

  const bannerCount = await prisma.banner.count();
  if (bannerCount === 0) {
    await prisma.banner.createMany({
      data: [
        { image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2070&auto=format&fit=crop', href: '/catalog', title: 'Katalog', sortOrder: 0, isActive: true },
        { image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop', href: '/catalog?sortBy=price&sortOrder=asc', title: 'Arzon narxlarda', sortOrder: 1, isActive: true },
        { image: 'https://images.unsplash.com/photo-1472851294608-062f824d78cc?q=80&w=2070&auto=format&fit=crop', href: '/favorites', title: 'Sevimlilar', sortOrder: 2, isActive: true },
      ],
    });
    console.log('Banners seeded: 3');
  }

  // Тестовые покупатели для отзывов (30 шт., чтобы по одному отзыву на пару товар+покупатель = до 30 отзывов на товар)
  const buyerPass = await bcrypt.hash('Buyer123!', 10);
  const buyerEmails: string[] = [];
  const buyerNames: Array<[string, string]> = [];
  for (let i = 1; i <= 30; i++) {
    buyerEmails.push(`buyer${i}@test.uz`);
    buyerNames.push([`Buyer${i}`, `Test${i}`]);
  }
  const buyers: { id: string }[] = [];
  for (let i = 0; i < buyerEmails.length; i++) {
    const u = await prisma.user.upsert({
      where: { email: buyerEmails[i]! },
      update: { passwordHash: buyerPass, role: 'BUYER', firstName: buyerNames[i]![0], lastName: buyerNames[i]![1] },
      create: {
        email: buyerEmails[i]!,
        passwordHash: buyerPass,
        firstName: buyerNames[i]![0],
        lastName: buyerNames[i]![1],
        role: 'BUYER',
        emailVerified: true,
      },
    });
    buyers.push({ id: u.id });
  }
  console.log('Buyers for reviews:', buyers.length);

  // По 20–30 отзывов на каждый товар. В БД может быть уникальность (productId, userId), поэтому один отзыв на пару (товар, покупатель).
  const deleted = await prisma.review.deleteMany({});
  if (deleted.count > 0) console.log('Deleted existing reviews:', deleted.count);
  const products = await prisma.product.findMany({ where: { shopId: shop!.id }, select: { id: true } });
  const comments = [
    'Juda yaxshi mahsulot, tavsiya qilaman!',
    'Tez yetkazib berildi, rahmat.',
    'Sifat zo\'r, narxi ham oqilona.',
    'Birinchi marta xarid qildim, mamnunman.',
    'Yaxshi ishlov berilgan, yetarlicha.',
    'Kutilganidek bo\'ldi, minnatdorman.',
    'O\'rtacha, lekin narxiga qarab yaxshi.',
    'Yana buyurtma beraman.',
    'Sotuvchi bilan muloqot qulay edi.',
    'Mahsulot tasvirdagidek kelindi.',
    'Biroz kechikdi, lekin boshqacha yaxshi.',
    'Sifat yaxshi, yetkazib berish tez.',
    'Rang va o\'lcham mos keldi.',
    'Hammasi yoqdi, rahmat do\'konga!',
    null,
    null,
    null,
  ];

  function shuffle<T>(arr: T[]): T[] {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }

  let totalReviews = 0;
  for (const product of products) {
    const count = Math.min(20 + Math.floor(Math.random() * 11), buyers.length); // 20–30, но не больше числа покупателей
    const shuffled = shuffle(buyers);
    for (let i = 0; i < count; i++) {
      const buyer = shuffled[i]!;
      const rating = 1 + Math.floor(Math.random() * 5);
      const comment = comments[Math.floor(Math.random() * comments.length)] ?? null;
      await prisma.review.create({
        data: {
          productId: product.id,
          userId: buyer.id,
          rating,
          comment,
        },
      });
      totalReviews++;
    }
  }
  console.log('Reviews seeded:', totalReviews, 'across', products.length, 'products');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
