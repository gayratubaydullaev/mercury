import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ModerateProductDto {
  @ApiProperty()
  @IsBoolean()
  approve!: boolean;
}
