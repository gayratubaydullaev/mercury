import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdatePlatformSettingsDto {
  @ApiPropertyOptional({ description: 'Название маркетплейса (шапка, футер, title)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  siteName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  commissionRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPayoutAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  paymentClickEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  paymentPaymeEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  paymentCashEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  paymentCardOnDeliveryEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  deliveryEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pickupEnabled?: boolean;

  /** Admin Telegram Chat ID — вручную или из .env; при пустой строке сбрасывается */
  @ApiPropertyOptional({ description: 'Admin Telegram chat ID (число, напр. 123456789)' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  adminTelegramChatId?: string | null;
}
