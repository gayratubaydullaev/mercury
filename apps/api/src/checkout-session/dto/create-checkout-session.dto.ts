import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';
import { ShippingAddressDto } from '../../orders/dto/shipping-address.dto';

export enum DeliveryType {
  DELIVERY = 'DELIVERY',
  PICKUP = 'PICKUP',
}

export class CreateCheckoutSessionDto {
  @ApiProperty({ enum: PaymentMethod, description: 'Must be CLICK or PAYME' })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional({ enum: DeliveryType })
  @IsOptional()
  @IsEnum(DeliveryType)
  deliveryType?: DeliveryType;

  @ApiPropertyOptional({ description: 'Shipping address (required for DELIVERY)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress?: ShippingAddressDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
