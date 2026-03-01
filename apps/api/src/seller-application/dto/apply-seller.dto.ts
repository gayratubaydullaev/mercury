import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class ApplySellerDto {
  @ApiProperty({ description: 'Название магазина' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  shopName!: string;

  @ApiProperty({ description: 'Описание магазина (опционально)', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ description: 'Сообщение администратору (опционально)', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  message?: string;
}
