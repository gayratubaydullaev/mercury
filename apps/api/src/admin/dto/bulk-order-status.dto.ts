import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsUUID } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class BulkOrderStatusDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  orderIds!: string[];

  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
