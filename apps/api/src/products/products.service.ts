import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductFilterDto } from './dto/product-filter.dto';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

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
    const slug = dto.slug ?? dto.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const hasVariants = dto.variants?.length;
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

  async findShopBySlug(slug: string) {
    const shop = await this.prisma.shop.findFirst({
      where: { slug, isActive: true },
      select: { id: true, name: true, slug: true, description: true },
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
}
