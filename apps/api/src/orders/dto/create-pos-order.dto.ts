import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PosOrderLineDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ description: 'Required when the product has variants' })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreatePosOrderDto {
  @ApiProperty({ type: [PosOrderLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PosOrderLineDto)
  items!: PosOrderLineDto[];

  @ApiProperty({ enum: ['CASH', 'CARD_ON_DELIVERY'], description: 'In-store: naqd yoki karta (terminal)' })
  @IsIn(['CASH', 'CARD_ON_DELIVERY'])
  paymentMethod!: 'CASH' | 'CARD_ON_DELIVERY';

  @ApiPropertyOptional({
    default: true,
    description: 'If true, payment is recorded as received immediately (typical retail)',
  })
  @IsOptional()
  @IsBoolean()
  markPaid?: boolean;

  @ApiPropertyOptional({ description: 'Buyer phone for receipt / guest order lookup' })
  @IsOptional()
  @IsString()
  guestPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
