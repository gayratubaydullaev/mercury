import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength, IsArray } from 'class-validator';

export class ApplySellerDto {
  @ApiProperty({ description: 'Название магазина' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  shopName!: string;

  @ApiPropertyOptional({ description: 'Описание магазина' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Сообщение администратору' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional({ description: 'Тип юрлица: IP | OOO' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  legalType?: string;

  @ApiPropertyOptional({ description: 'Полное название ИП/ООО' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  legalName?: string;

  @ApiPropertyOptional({ description: 'ОГРН' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  ogrn?: string;

  @ApiPropertyOptional({ description: 'ИНН' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  inn?: string;

  @ApiPropertyOptional({ description: 'URL фото документов (загружаются через /upload/image)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentUrls?: string[];
}
