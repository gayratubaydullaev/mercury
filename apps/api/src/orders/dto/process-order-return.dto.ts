import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class OrderReturnLineDto {
  @IsString()
  orderItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class ProcessOrderReturnDto {
  @IsOptional()
  @IsBoolean()
  fullOrder?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderReturnLineDto)
  items?: OrderReturnLineDto[];

  @IsOptional()
  @IsString()
  note?: string;
}
