import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min, ValidateIf } from 'class-validator';

export class SetSellerCommissionDto {
  @ApiProperty({ description: 'Commission rate (0-100) or null for platform default' })
  @ValidateIf((_o, v) => v != null)
  @IsNumber()
  @Min(0)
  commissionRate!: number | null;
}
