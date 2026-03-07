import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductFilterDto } from './dto/product-filter.dto';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as XLSX from 'xlsx';

const EXCEL_IMPORT_MAX_ROWS = 500;
const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 10000;

/** Парсинг числа из ячейки Excel (строка с пробелами/запятыми или число). */
function parseNum(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number' && !isNaN(value)) return value;
  const s = String(value).replace(/\s/g, '').replace(/,/g, '.');
  const n = parseFloat(s);
  return isNaN(n) ? undefined : n;
}

/** Нормализация для сравнения опций (пробелы, регистр ключей). */
function normOpt(s: string): string {
  return String(s ?? '').replace(/\s+/g, '').trim();
}

/** Проверяет: при наличии options у каждой комбинации значений должен быть ровно один вариант. */
function validateOptionsAndVariants(
  options: Record<string, string[]>,
  variants: Array<{ options: Record<string, string> }>,
): void {
  const keys = Object.keys(options);
  if (keys.length === 0) return;
  const allowed = new Map<string, Set<string>>();
  for (const k of keys) {
    const vals = (options[k] ?? []).map((v) => normOpt(v));
    allowed.set(k, new Set(vals));
  }
  const variantCombos = new Set<string>();
  for (const v of variants) {
    const combo: string[] = [];
    for (const k of keys) {
      const val = (v.options ?? {})[k];
      if (val == null || val === '') {
        throw new BadRequestException(
          `Variantda "${k}" uchun qiymat ko'rsatilmagan. Barcha variantlar har bir option (${keys.join(', ')}) uchun qiymatga ega bo'lishi kerak.`,
        );
      }
      const n = normOpt(val);
      if (!allowed.get(k)?.has(n)) {
        throw new BadRequestException(
          `Variantda "${k}": "${val}" ruxsat etilmagan. Ruxsat etilgan qiymatlar: ${(options[k] ?? []).join(', ')}`,
        );
      }
      combo.push(`${k}=${n}`);
    }
    const key = combo.sort().join('|');
    if (variantCombos.has(key)) {
      throw new BadRequestException(
        `Bir xil variant ikki marta kiritilgan: ${combo.join(', ')}. Har bir kombinatsiya bitta variant bo'lishi kerak.`,
      );
    }
    variantCombos.add(key);
  }
  // Декартово произведение — все комбинации
  function cartesian(acc: string[][], keyIndex: number): string[][] {
    if (keyIndex >= keys.length) return acc;
    const k = keys[keyIndex];
    const vals = (options[k] ?? []).map((v) => normOpt(v));
    if (vals.length === 0) return cartesian(acc, keyIndex + 1);
    const next: string[][] = [];
    for (const row of acc) {
      for (const v of vals) {
        next.push([...row, `${k}=${v}`]);
      }
    }
    return cartesian(next.length ? next : vals.map((v) => [`${k}=${v}`]), keyIndex + 1);
  }
  const required = cartesian([[]], 0).map((parts) => parts.sort().join('|'));
  const missing = required.filter((r) => !variantCombos.has(r));
  if (missing.length > 0) {
    throw new BadRequestException(
      `Variantlar to'liq emas. Quyidagi kombinatsiyalar uchun variant qo'shing: ${missing.slice(0, 5).join('; ')}${missing.length > 5 ? ` ... va yana ${missing.length - 5} ta` : ''}. Har bir option qiymatlari kombinatsiyasi uchun bitta variant bo'lishi kerak.`,
    );
  }
  const extra = [...variantCombos].filter((r) => !required.includes(r));
  if (extra.length > 0) {
    throw new BadRequestException(
      `Variantda product options'da bo'lmagan qiymat ishlatilgan: ${extra.slice(0, 3).join('; ')}.`,
    );
  }
}

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
  ) {}

  async create(sellerId: string, dto: CreateProductDto) {
    const shop = await this.prisma.shop.findFirst({ where: { userId: sellerId } });
    if (!shop) throw new ForbiddenException('Shop not found');
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundException('Category not found');
    if (category.parentId == null) {
      throw new BadRequestException('Mahsulot faqat ostkategoriyaga biriktirilishi mumkin');
    }
    if (dto.comparePrice != null && dto.comparePrice < dto.price) {
      throw new BadRequestException(
        'Solishtirish narxi (eski narx) joriy narxdan kam boʻlishi mumkin emas. Sunʼiy chegirma yaratish taqiqlanadi.',
      );
    }
    const slug = dto.slug ?? dto.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const hasVariants = dto.variants?.length;
    if (hasVariants && dto.options && Object.keys(dto.options).length > 0) {
      validateOptionsAndVariants(dto.options, dto.variants!);
    }
    const totalStock = hasVariants
      ? dto.variants!.reduce((s, v) => s + (v.stock ?? 0), 0)
      : (dto.stock ?? 0);
    const product = await this.prisma.product.create({
      data: {
        title: dto.title,
        slug,
        description: dto.description,
        price: new Decimal(dto.price),
        comparePrice: dto.comparePrice != null ? new Decimal(dto.comparePrice) : null,
        stock: totalStock,
        sku: hasVariants ? undefined : dto.sku,
        categoryId: dto.categoryId,
        shopId: shop.id,
        options: dto.options ?? undefined,
        specs: dto.specs ?? undefined,
        unit: dto.unit?.trim() || undefined,
        images: dto.imageUrls?.length
          ? { create: dto.imageUrls.map((url, i) => ({ url, sortOrder: i })) }
          : undefined,
      },
      include: { images: true, category: true, variants: true, shop: { select: { name: true } } },
    });
    this.telegram.sendAdminPendingProductNotification(product).catch(() => {});
    if (hasVariants) {
      await this.prisma.productVariant.createMany({
        data: dto.variants!.map((v) => ({
          productId: product.id,
          options: v.options,
          stock: v.stock ?? 0,
          imageUrl: v.imageUrl ?? null,
          sku: v.sku ?? null,
          priceOverride: v.priceOverride != null ? new Decimal(v.priceOverride) : null,
        })),
      });
      const updated = await this.prisma.product.findUniqueOrThrow({
        where: { id: product.id },
        include: { images: true, category: true, variants: true, shop: { select: { name: true } } },
      });
      return updated;
    }
    return product;
  }

  async findAll(filters: ProductFilterDto) {
    const where: Prisma.ProductWhereInput = { isActive: true, isModerated: true, stock: { gt: 0 } };
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.categorySlug) {
      const cat = await this.prisma.category.findUnique({ where: { slug: filters.categorySlug } });
      if (cat) where.categoryId = cat.id;
    }
    if (filters.shopSlug) where.shop = { slug: filters.shopSlug };
    if (filters.minPrice != null || filters.maxPrice != null) {
      where.price = {};
      if (filters.minPrice != null) (where.price as Prisma.DecimalFilter).gte = new Decimal(filters.minPrice);
      if (filters.maxPrice != null) (where.price as Prisma.DecimalFilter).lte = new Decimal(filters.maxPrice);
    }
    const searchQuery = filters.search?.trim().replace(/\s+/g, ' ').slice(0, 200) || undefined;
    if (searchQuery) {
      const words = searchQuery.split(/\s+/).filter(Boolean);
      const existingAnd = where.AND;
      const andArray: Prisma.ProductWhereInput[] = Array.isArray(existingAnd) ? existingAnd : existingAnd ? [existingAnd] : [];
      const searchConditions: Prisma.ProductWhereInput[] = words.map((word) => ({
        OR: [
          { title: { contains: word, mode: 'insensitive' as const } },
          { description: { contains: word, mode: 'insensitive' as const } },
          { slug: { contains: word, mode: 'insensitive' as const } },
          { sku: { contains: word, mode: 'insensitive' as const } },
        ],
      }));
      where.AND = [...andArray, ...searchConditions];
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    if (filters.sortBy === 'random') {
      const total = await this.prisma.product.count({
        where: { isActive: true, isModerated: true, stock: { gt: 0 }, category: { parentId: { not: null } } },
      });
      const seed = filters.seed ?? String(Date.now());
      const idsResult = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT p.id FROM "products" p
        INNER JOIN "categories" c ON p."category_id" = c.id
        WHERE p."is_active" = true AND p."is_moderated" = true AND p.stock > 0
        AND c."parent_id" IS NOT NULL
        ORDER BY md5(p.id || ${seed})
        LIMIT ${limit} OFFSET ${skip}
      `;
      const ids = idsResult.map((r) => r.id);
      if (ids.length === 0) {
        return { data: [], total, page, limit, totalPages: Math.ceil(total / limit) };
      }
      const products = await this.prisma.product.findMany({
        where: { id: { in: ids } },
        include: { images: true, category: true, shop: { select: { name: true, slug: true } }, variants: true, reviews: { where: { isModerated: true }, select: { rating: true } } },
      });
      const orderMap = new Map(ids.map((id, i) => [id, i]));
      products.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
      type ProductWithReviews = (typeof products)[number] & { reviews: { rating: number }[] };
      const data = products.map((p) => {
        const { reviews, ...rest } = p as ProductWithReviews;
        const count = reviews.length;
        const avgRating = count ? Math.round((reviews.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / count) * 10) / 10 : null;
        return { ...rest, reviewsCount: count, avgRating };
      });
      return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    const useRelevance = searchQuery && (filters.sortBy === 'relevance' || (!filters.sortBy && searchQuery));
    const orderBy: Prisma.ProductOrderByWithRelationInput = {};
    if (filters.sortBy === 'price') orderBy.price = filters.sortOrder ?? 'asc';
    else if (filters.sortBy === 'createdAt') orderBy.createdAt = filters.sortOrder ?? 'desc';
    else if (!useRelevance) orderBy.createdAt = 'desc';

    let rows: Awaited<ReturnType<typeof this.prisma.product.findMany>>;
    let total: number;
    if (useRelevance) {
      const escapeLike = (s: string) => s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      const fullPattern = `%${escapeLike(searchQuery!)}%`;
      const conditions: Prisma.Sql[] = [
        Prisma.sql`p.is_active = true`,
        Prisma.sql`p.is_moderated = true`,
        Prisma.sql`p.stock > 0`,
      ];
      if (where.categoryId) conditions.push(Prisma.sql`p.category_id = ${where.categoryId as string}`);
      if (where.shop) conditions.push(Prisma.sql`p.shop_id IN (SELECT id FROM shops WHERE slug = ${(where.shop as { slug: string }).slug})`);
      if (where.price) {
        const price = where.price as Prisma.DecimalFilter;
        if (price.gte != null) conditions.push(Prisma.sql`p.price >= ${price.gte}`);
        if (price.lte != null) conditions.push(Prisma.sql`p.price <= ${price.lte}`);
      }
      const words = searchQuery!.split(/\s+/).filter(Boolean);
      for (const word of words) {
        const pat = `%${escapeLike(word)}%`;
        conditions.push(
          Prisma.sql`(p.title ILIKE ${pat} OR p.description ILIKE ${pat} OR p.slug ILIKE ${pat} OR (p.sku IS NOT NULL AND p.sku ILIKE ${pat}))`,
        );
      }
      const [idsResult, totalCount] = await Promise.all([
        this.prisma.$queryRaw<{ id: string }[]>`
          SELECT p.id FROM products p
          WHERE ${Prisma.join(conditions, ' AND ')}
          ORDER BY (p.title ILIKE ${fullPattern}) DESC, (p.description ILIKE ${fullPattern}) DESC, p.created_at DESC
          LIMIT ${limit} OFFSET ${skip}
        `,
        this.prisma.product.count({ where }),
      ]);
      total = totalCount;
      const ids = idsResult.map((r) => r.id);
      if (ids.length === 0) {
        return { data: [], total, page, limit, totalPages: Math.ceil(total / limit) };
      }
      rows = await this.prisma.product.findMany({
        where: { id: { in: ids } },
        include: { images: true, category: true, shop: { select: { name: true, slug: true } }, variants: true, reviews: { where: { isModerated: true }, select: { rating: true } } },
      });
      const orderMap = new Map(ids.map((id, i) => [id, i]));
      rows.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
    } else {
      const [rowsList, totalCount] = await Promise.all([
        this.prisma.product.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: { images: true, category: true, shop: { select: { name: true, slug: true } }, variants: true, reviews: { where: { isModerated: true }, select: { rating: true } } },
        }),
        this.prisma.product.count({ where }),
      ]);
      rows = rowsList;
      total = totalCount;
    }
    type ProductWithReviews = (typeof rows)[number] & { reviews: { rating: number }[] };
    const data = rows.map((p) => {
      const { reviews, ...rest } = p as ProductWithReviews;
      const count = reviews.length;
      const avgRating = count ? Math.round((reviews.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / count) * 10) / 10 : null;
      return { ...rest, reviewsCount: count, avgRating };
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** Публичная информация о магазине для покупателей: реквизиты ИП/ООО показываем, документы — только админу. */
  async findShopBySlug(slug: string) {
    const shop = await this.prisma.shop.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        legalType: true,
        legalName: true,
        ogrn: true,
        inn: true,
        // documentUrls не отдаём — полная информация только для админа
      },
    });
    if (!shop) throw new NotFoundException('Shop not found');
    return shop;
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, isActive: true },
      include: { images: true, category: true, shop: true, variants: true, reviews: { where: { isModerated: true }, include: { user: { select: { firstName: true, lastName: true } } } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    const reviewsCount = product.reviews.length;
    const avgRating = reviewsCount ? Math.round((product.reviews.reduce((s, r) => s + r.rating, 0) / reviewsCount) * 10) / 10 : null;
    return { ...product, reviewsCount, avgRating };
  }

  async findBySlug(shopSlug: string, productSlug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug: productSlug, shop: { slug: shopSlug }, isActive: true },
      include: { images: true, category: true, shop: true, variants: true, reviews: { where: { isModerated: true }, include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: string, sellerId: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findFirst({
      where: { id, shop: { userId: sellerId } },
      include: { shop: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (dto.categoryId != null) {
      const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!category) throw new NotFoundException('Category not found');
      if (category.parentId == null) {
        throw new BadRequestException('Mahsulot faqat ostkategoriyaga biriktirilishi mumkin');
      }
    }
    const { imageUrls, variants, ...rest } = dto as UpdateProductDto & { variants?: Array<{ options: Record<string, string>; stock: number; imageUrl?: string; sku?: string; priceOverride?: number }> };
    const currentPrice = rest.price != null ? Number(rest.price) : Number(product.price);
    if (rest.comparePrice != null && rest.comparePrice < currentPrice) {
      throw new BadRequestException(
        'Solishtirish narxi (eski narx) joriy narxdan kam boʻlishi mumkin emas. Sunʼiy chegirma yaratish taqiqlanadi.',
      );
    }
    const data: Prisma.ProductUpdateInput = { ...rest };
    if (rest.price != null) data.price = new Decimal(rest.price);
    if (rest.comparePrice != null) data.comparePrice = new Decimal(rest.comparePrice);
    if (rest.specs !== undefined) data.specs = rest.specs ?? Prisma.JsonNull;
    if ((rest as { unit?: string }).unit !== undefined) data.unit = (rest as { unit?: string }).unit?.trim() || null;
    if (imageUrls !== undefined) {
      await this.prisma.productImage.deleteMany({ where: { productId: id } });
      data.images = imageUrls?.length
        ? { create: imageUrls.map((url, i) => ({ url, sortOrder: i })) }
        : undefined;
    }
    if (variants !== undefined) {
      const optionsForValidate = (rest.options ?? product?.options) as Record<string, string[]> | undefined;
      if (variants.length > 0 && optionsForValidate && Object.keys(optionsForValidate).length > 0) {
        validateOptionsAndVariants(optionsForValidate, variants);
      }
      await this.prisma.productVariant.deleteMany({ where: { productId: id } });
      if (variants.length > 0) {
        const totalStock = variants.reduce((s, v) => s + (v.stock ?? 0), 0);
        data.stock = totalStock;
        await this.prisma.productVariant.createMany({
          data: variants.map((v) => ({
            productId: id,
            options: v.options,
            stock: v.stock ?? 0,
            imageUrl: v.imageUrl ?? null,
            sku: v.sku ?? null,
            priceOverride: v.priceOverride != null ? new Decimal(v.priceOverride) : null,
          })),
        });
      }
    }
    return this.prisma.product.update({ where: { id }, data, include: { images: true, category: true, variants: true } });
  }

  async remove(id: string, sellerId: string) {
    const product = await this.prisma.product.findFirst({ where: { id, shop: { userId: sellerId } } });
    if (!product) throw new NotFoundException('Product not found');
    await this.prisma.product.update({ where: { id }, data: { isActive: false } });
    return { success: true };
  }

  async getSellerProducts(sellerId: string, page = 1, limit = 20) {
    const shop = await this.prisma.shop.findFirst({ where: { userId: sellerId } });
    if (!shop) return { data: [], total: 0, page, limit, totalPages: 0 };
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);
    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where: { shopId: shop.id },
        skip,
        take,
        include: { images: true, category: true },
      }),
      this.prisma.product.count({ where: { shopId: shop.id } }),
    ]);
    const data = rows.map((p) => ({
      ...p,
      price: p.price.toString(),
      comparePrice: p.comparePrice != null ? p.comparePrice.toString() : null,
    }));
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getSellerProductById(id: string, sellerId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, shop: { userId: sellerId } },
      include: { images: true, category: true, variants: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  /** Скачать шаблон Excel для массовой загрузки товаров */
  async getImportTemplate(): Promise<Buffer> {
    const leafCategories = await this.prisma.category.findMany({
      where: { parentId: { not: null } },
      orderBy: { name: 'asc' },
      select: { slug: true, name: true },
    });
    const headerRow = [
      'Nomi', 'Tavsif', 'Narx (soʻm)', 'Qoldiq', 'SKU (ixtiyoriy)', 'Kategoriya slug',
      'Rasmlar URL (vergul bilan)', 'Birlik (dona, kg...)', 'Xususiyatlar (kalit:qiymat; kalit2:qiymat2)',
      'Xususiyat 1 nomi', 'Xususiyat 1 qiymat', 'Xususiyat 2 nomi', 'Xususiyat 2 qiymat', 'Xususiyat 3 nomi', 'Xususiyat 3 qiymat',
      "Variant 1 nomi (masalan: O'lcham)", "Variant 1 qiymat (masalan: S)", "Variant 2 nomi (masalan: Rang)", "Variant 2 qiymat (masalan: Qora)",
    ];
    const example1 = [
      'Smartfon Samsung A54', 'Yaxshi kamera va batareya', 4500000, 10, 'SAM-A54',
      leafCategories[0]?.slug ?? 'elektronika', '', 'dona', 'Rang:Qora; Xotira:128GB',
      'Material', 'Alyuminiy', 'Og\'irlik', '200 g', 'Ekran', '6.4"',
      '', '', '', '',
    ];
    const example2 = [
      'Futbolka erkaklar uchun', 'Paxta 100%', 150000, 5, 'FUT-S',
      leafCategories[1]?.slug ?? leafCategories[0]?.slug ?? 'odejda', '', 'dona', '',
      "O'lcham", 'S', 'Material', 'Paxta 100%', 'Mamlakat', 'O\'zbekiston',
      "O'lcham", 'S', 'Rang', 'Qora',
    ];
    const example3 = [
      'Futbolka erkaklar uchun', 'Paxta 100%', 150000, 3, 'FUT-M',
      leafCategories[1]?.slug ?? leafCategories[0]?.slug ?? 'odejda', '', 'dona', '',
      "O'lcham", 'M', 'Material', 'Paxta 100%', '', '',
      "O'lcham", 'M', 'Rang', 'Qora',
    ];
    const example4 = [
      'Futbolka erkaklar uchun', 'Paxta 100%', 150000, 8, '',
      leafCategories[1]?.slug ?? leafCategories[0]?.slug ?? 'odejda', '', 'dona', '',
      '', '', '', '', '', '',
      "O'lcham", 'M', 'Rang', 'Oq',
    ];
    const ws = XLSX.utils.aoa_to_sheet([headerRow, example1, example2, example3, example4]);
    const colWidths = [{ wch: 25 }, { wch: 40 }, { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 18 }, { wch: 35 }, { wch: 14 }, { wch: 35 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 22 }, { wch: 18 }];
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tovarlar');
    const categoriesSheet = XLSX.utils.json_to_sheet(
      leafCategories.map((c) => ({ slug: c.slug, name: c.name })),
    );
    (categoriesSheet['!cols'] as XLSX.ColInfo[]) = [{ wch: 22 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, categoriesSheet, 'Kategoriyalar');
    const variantHelp = XLSX.utils.aoa_to_sheet([
      ['Variantlar va xususiyatlar'],
      [],
      ['Xususiyatlar (harakteristikalar):'],
      ['  — "Xususiyatlar" ustunida: kalit:qiymat; kalit2:qiymat2 (masalan: Material:Paxta; Og\'irlik:200g)'],
      ['  — Yoki alohida ustunlar: "Xususiyat 1 nomi" va "Xususiyat 1 qiymat", 2 va 3 xuddi shunday. Ikkalasini ham ishlatish mumkin.'],
      [],
      ['Variantlar:'],
      ['Bir xil Nomi, Tavsif, Narx va Kategoriya slug boʻlgan qatorlar bitta mahsulot hisoblanadi.'],
      ['Agar "Variant 1 nomi" va "Variant 1 qiymat" (ixtiyoriy "Variant 2" ustunlari) toʻldirilsa, har bir qator bitta variant boʻladi.'],
      ['Misol: Futbolka uchun 3 qator — S-Qora (qoldiq 5), M-Qora (3), M-Oq (8). Natijada 1 ta mahsulot, 3 ta variant.'],
      ['Variant ustunlari boʻsh qator — oddiy mahsulot (variantsiz).'],
    ]);
    (variantHelp['!cols'] as XLSX.ColInfo[]) = [{ wch: 70 }];
    XLSX.utils.book_append_sheet(wb, variantHelp, 'Variantlar qoʻllanmasi');
    return Buffer.from(XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }));
  }

  /** Импорт товаров из Excel (только продавец) */
  async importFromExcel(
    sellerId: string,
    buffer: Buffer,
  ): Promise<{ created: number; failed: number; createdTitles: string[]; errors: { row: number; title?: string; message: string }[] }> {
    const shop = await this.prisma.shop.findFirst({ where: { userId: sellerId } });
    if (!shop) throw new ForbiddenException('Shop not found');
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const firstSheet = wb.SheetNames[0];
    const ws = wb.Sheets[firstSheet];
    if (!ws) throw new BadRequestException('Excel faylida hech qanday varaq topilmadi');
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false });
    if (rows.length > EXCEL_IMPORT_MAX_ROWS) {
      throw new BadRequestException(
        `Maksimum ${EXCEL_IMPORT_MAX_ROWS} ta qator qabul qilinadi. Sizda ${rows.length} ta. Faylni boʻling yoki qatorlarni kamaytiring.`,
      );
    }
    const categoryBySlug = new Map<string, { id: string }>();
    const leafCategories = await this.prisma.category.findMany({
      where: { parentId: { not: null } },
      select: { id: true, slug: true },
    });
    leafCategories.forEach((c) => categoryBySlug.set(c.slug, { id: c.id }));

    const errors: { row: number; title?: string; message: string }[] = [];
    const createdTitles: string[] = [];
    let created = 0;
    const headerRow = 1;

    const col = (r: Record<string, unknown>, ...keys: string[]) => {
      for (const k of keys) {
        const v = r?.[k];
        if (v !== undefined && v !== null && v !== '') return v;
      }
      return undefined;
    };
    const colStr = (r: Record<string, unknown>, ...keys: string[]) => String(col(r, ...keys) ?? '').trim();

    const isEmptyRow = (r: Record<string, unknown>) => {
      const vals = Object.values(r);
      return vals.every((v) => v === undefined || v === null || v === '' || String(v).trim() === '');
    };

    type ParsedRow = {
      rowNum: number;
      title: string;
      description: string;
      price: number;
      categoryId: string;
      categorySlug: string;
      stock: number;
      sku?: string;
      imageUrls?: string[];
      unit?: string;
      specs?: Record<string, string>;
      opt1Name: string;
      opt1Value: string;
      opt2Name: string;
      opt2Value: string;
    };

    const parsed: ParsedRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as Record<string, unknown>;
      const rowNum = headerRow + 1 + i;
      if (isEmptyRow(row)) continue;
      const title = colStr(row, 'Nomi', 'title');
      if (title === 'Nomi' || title === 'title') continue;
      const description = colStr(row, 'Tavsif', 'description');
      const priceRaw = col(row, 'Narx (soʻm)', 'price');
      const categorySlug = colStr(row, 'Kategoriya slug', 'categorySlug');

      if (!title) {
        errors.push({ row: rowNum, message: 'Nomi toʻldirilishi shart' });
        continue;
      }
      if (title.length > TITLE_MAX_LENGTH) {
        errors.push({ row: rowNum, title, message: `Nomi ${TITLE_MAX_LENGTH} belgidan oshmasligi kerak` });
        continue;
      }
      if (!description) {
        errors.push({ row: rowNum, title, message: 'Tavsif toʻldirilishi shart' });
        continue;
      }
      if (description.length > DESCRIPTION_MAX_LENGTH) {
        errors.push({ row: rowNum, title, message: `Tavsif ${DESCRIPTION_MAX_LENGTH} belgidan oshmasligi kerak` });
        continue;
      }
      const price = parseNum(priceRaw);
      if (price === undefined || price < 0) {
        errors.push({ row: rowNum, title, message: 'Narx musbat son boʻlishi kerak' });
        continue;
      }
      if (!categorySlug) {
        errors.push({ row: rowNum, title, message: 'Kategoriya slug kiritilishi shart. "Kategoriyalar" varaqiga qarang' });
        continue;
      }
      const category = categoryBySlug.get(categorySlug);
      if (!category) {
        errors.push({ row: rowNum, title, message: `Kategoriya topilmadi: "${categorySlug}". "Kategoriyalar" varaqidagi slug dan foydalaning` });
        continue;
      }
      const stockRaw = col(row, 'Qoldiq', 'stock');
      const stock = stockRaw !== undefined && stockRaw !== null && stockRaw !== ''
        ? Math.max(0, Math.floor(Number(stockRaw)) || 0)
        : 0;
      const sku = colStr(row, 'SKU (ixtiyoriy)', 'sku') || undefined;
      const imageUrlsStr = colStr(row, 'Rasmlar URL (vergul bilan)', 'imageUrls');
      const imageUrls = imageUrlsStr ? imageUrlsStr.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
      const unit = colStr(row, 'Birlik (dona, kg...)', 'unit') || undefined;
      const specsStr = colStr(row, 'Xususiyatlar (kalit:qiymat; kalit2:qiymat2)', 'specs');
      const specs: Record<string, string> = {};
      if (specsStr) {
        for (const part of specsStr.split(';')) {
          const [k, v] = part.split(':').map((s) => s.trim());
          if (k && v) specs[k] = v;
        }
      }
      const spec1Name = colStr(row, 'Xususiyat 1 nomi');
      const spec1Val = colStr(row, 'Xususiyat 1 qiymat');
      const spec2Name = colStr(row, 'Xususiyat 2 nomi');
      const spec2Val = colStr(row, 'Xususiyat 2 qiymat');
      const spec3Name = colStr(row, 'Xususiyat 3 nomi');
      const spec3Val = colStr(row, 'Xususiyat 3 qiymat');
      if (spec1Name && spec1Val) specs[spec1Name] = spec1Val;
      if (spec2Name && spec2Val) specs[spec2Name] = spec2Val;
      if (spec3Name && spec3Val) specs[spec3Name] = spec3Val;
      const specsFinal = Object.keys(specs).length > 0 ? specs : undefined;
      const opt1Name = colStr(row, "Variant 1 nomi (masalan: O'lcham)", 'Variant 1 nomi');
      const opt1Value = colStr(row, "Variant 1 qiymat (masalan: S)", 'Variant 1 qiymat');
      const opt2Name = colStr(row, "Variant 2 nomi (masalan: Rang)", 'Variant 2 nomi');
      const opt2Value = colStr(row, "Variant 2 qiymat (masalan: Qora)", 'Variant 2 qiymat');
      parsed.push({
        rowNum, title, description, price, categoryId: category.id, categorySlug, stock, sku, imageUrls, unit, specs: specsFinal,
        opt1Name, opt1Value, opt2Name, opt2Value,
      });
    }

    const productKey = (p: ParsedRow) => `${p.title}\t${p.description}\t${p.price}\t${p.categorySlug}`;
    const groups = new Map<string, ParsedRow[]>();
    for (const p of parsed) {
      const key = productKey(p);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }

    for (const groupRows of groups.values()) {
      const first = groupRows[0];
      const hasVariants = groupRows.some((r) => r.opt1Name || r.opt1Value || r.opt2Name || r.opt2Value);

      if (!hasVariants) {
        const dto: CreateProductDto = {
          title: first.title,
          description: first.description,
          price: first.price,
          stock: first.stock,
          sku: first.sku,
          categoryId: first.categoryId,
          imageUrls: first.imageUrls,
          unit: first.unit,
          specs: first.specs,
        };
        try {
          await this.create(sellerId, dto);
          created++;
          createdTitles.push(first.title);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push({ row: first.rowNum, title: first.title, message: msg });
        }
        continue;
      }

      const name1 = groupRows.map((r) => r.opt1Name).find(Boolean) ?? '';
      let name2 = groupRows.map((r) => r.opt2Name).find(Boolean) ?? '';
      if (name2 === name1) name2 = '';
      const options: Record<string, string[]> = {};
      const valueByOpt = new Map<string, Set<string>>();
      for (const r of groupRows) {
        if (name1 && r.opt1Value) {
          if (!valueByOpt.has(name1)) valueByOpt.set(name1, new Set());
          valueByOpt.get(name1)!.add(r.opt1Value);
        }
        if (name2 && r.opt2Value) {
          if (!valueByOpt.has(name2)) valueByOpt.set(name2, new Set());
          valueByOpt.get(name2)!.add(r.opt2Value);
        }
      }
      for (const [name, vals] of valueByOpt) {
        options[name] = [...vals];
      }
      const variants = groupRows.map((r) => {
        const opts: Record<string, string> = {};
        if (name1 && r.opt1Value) opts[name1] = r.opt1Value;
        if (name2 && r.opt2Value) opts[name2] = r.opt2Value;
        return { options: opts, stock: r.stock, imageUrl: undefined as string | undefined, sku: r.sku };
      });

      const dto: CreateProductDto = {
        title: first.title,
        description: first.description,
        price: first.price,
        categoryId: first.categoryId,
        imageUrls: first.imageUrls,
        unit: first.unit,
        specs: first.specs,
        options,
        variants,
      };
      try {
        await this.create(sellerId, dto);
        created++;
        createdTitles.push(first.title);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ row: first.rowNum, title: first.title, message: msg });
      }
    }
    return { created, failed: errors.length, createdTitles, errors };
  }
}
