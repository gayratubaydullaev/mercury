import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateBannerDto {
  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  image!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  href!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  external?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(120)
  @Type(() => Number)
  sortOrder?: number;

  /** Время показа слайда в карусели (секунды), 1–60. */
  @ApiPropertyOptional({ minimum: 1, maximum: 60 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(60)
  @Type(() => Number)
  displaySeconds?: number;

  /** Показывать баннер с этой даты (ISO string). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  /** Деактивировать баннер после этой даты (ISO string). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
