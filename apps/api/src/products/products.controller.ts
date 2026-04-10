import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Header, Res, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as multer from 'multer';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductFilterDto } from './dto/product-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private products: ProductsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create product (seller)' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateProductDto) {
    return this.products.create(userId, dto);
  }

  @Get()
  @Public()
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOperation({ summary: 'List products with filters' })
  findAll(@Query() query: ProductFilterDto) {
    return this.products.findAll(query);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My products (seller)' })
  myProducts(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string | number,
    @Query('limit') limit?: string | number,
    @Query('search') search?: string,
  ) {
    const pageNum = page != null ? Math.max(1, Number(page) || 1) : 1;
    const limitNum = limit != null ? Math.min(100, Math.max(1, Number(limit) || 20)) : 20;
    return this.products.getSellerProducts(userId, pageNum, limitNum, search);
  }

  @Get('my/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my product by id (seller, including inactive)' })
  myProduct(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.products.getSellerProductById(id, userId);
  }

  @Get('import-template')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download Excel template for bulk product import' })
  async getImportTemplate(@Res() res: Response) {
    const buffer = await this.products.getImportTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="tovarlar-shabloni.xlsx"');
    res.send(buffer);
  }

  @Post('import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Import products from Excel file' })
  async importProducts(@CurrentUser('id') userId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Fayl tanlanmadi. Excel (.xlsx, .xls) faylini yuklang.');
    const buf = (file as Express.Multer.File & { buffer?: Buffer }).buffer;
    if (!buf) throw new BadRequestException('Fayl yuklanmadi. Qaytadan urinib koʻring.');
    return this.products.importFromExcel(userId, buf);
  }

  @Get('shop-info/:slug')
  @Public()
  @ApiOperation({ summary: 'Get shop public info by slug' })
  getShopBySlug(@Param('slug') slug: string) {
    return this.products.findShopBySlug(slug);
  }

  @Get('shop/:shopSlug/:productSlug')
  @Public()
  @ApiOperation({ summary: 'Get product by shop and product slug' })
  findBySlug(@Param('shopSlug') shopSlug: string, @Param('productSlug') productSlug: string) {
    return this.products.findBySlug(shopSlug, productSlug);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get product by id' })
  findOne(@Param('id') id: string) {
    return this.products.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  @ApiBearerAuth()
  update(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, userId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  @ApiBearerAuth()
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.products.remove(id, userId);
  }
}
