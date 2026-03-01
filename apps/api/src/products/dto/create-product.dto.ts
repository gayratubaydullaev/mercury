import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsUUID, IsArray, Min, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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

  /** Xususiyatlar (kalit–qiymat), masalan { "Material": "Paxta", "Og'irlik": "200g" } */
  @ApiPropertyOptional({ example: { Material: 'Paxta', "O'lcham": 'M' } })
  @IsOptional()
  @IsObject()
  specs?: Record<string, string>;
}
