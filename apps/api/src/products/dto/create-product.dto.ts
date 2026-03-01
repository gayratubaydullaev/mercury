import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsUUID, IsArray, Min, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Универсальная модель товара для любых типов магазинов и категорий:
 * - Канцелярия, одежда: options (O'lcham, Rang), specs (Material, Og'irlik)
 * - Стройматериалы: options (Hajm, Turi), specs (O'lcham, Material, Birlik)
 * - Продукты: options (Hajm), specs (Srok godnosti, Og'irlik)
 * Категории задаются админом (дерево); товар привязывается к подкатегории.
 * options/variants — для выбора варианта (размер/цвет/объём); specs — произвольные атрибуты (ключ–значение).
 */

class VariantItemDto {
  @IsObject()
  options!: Record<string, string>;
  @IsNumber()
  @Min(0)
  stock!: number;
  @IsOptional()
  @IsString()
  imageUrl?: string;
  @IsOptional()
  @IsString()
  sku?: string;
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceOverride?: number;
}

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  comparePrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty()
  @IsUUID()
  categoryId!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  /** Варианты товара (nomlari va qiymatlari), напр. { "O'lcham": ["S","M","L"], "Rang": ["Qora","Oq"] } */
  @ApiPropertyOptional({ example: { "O'lcham": ['S', 'M', 'L'] } })
  @IsOptional()
  @IsObject()
  options?: Record<string, string[]>;

  /** Har bir variant uchun qoldiq va ixtiyoriy rasm/SKU/narx. options boʻlsa, variantlar yuborilishi mumkin. */
  @ApiPropertyOptional({ type: [VariantItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantItemDto)
  variants?: VariantItemDto[];

  /** Xususiyatlar (kalit–qiymat), masalan { "Material": "Paxta", "Og'irlik": "200g" } yoki { "O'lcham": "50x100mm", "Birlik": "m2" } */
  @ApiPropertyOptional({ example: { Material: 'Paxta', "O'lcham": 'M' } })
  @IsOptional()
  @IsObject()
  specs?: Record<string, string>;

  /** Birlik (narx uchun): dona, kg, m2, m, l — ixtiyoriy, masalan qurilish yoki oziq-ovqat uchun */
  @ApiPropertyOptional({ example: 'dona' })
  @IsOptional()
  @IsString()
  unit?: string;
}
