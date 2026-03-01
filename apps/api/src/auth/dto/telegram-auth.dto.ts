import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class TelegramAuthDto {
  @ApiProperty({ description: 'Telegram Web App initData query string' })
  @IsString()
  @IsNotEmpty()
  initData!: string;
}
