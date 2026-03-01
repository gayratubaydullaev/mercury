import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

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
  sortOrder?: number;
}
