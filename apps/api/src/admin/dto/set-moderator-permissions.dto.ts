import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class SetModeratorPermissionsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canModerateProducts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canModerateReviews?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canApproveSellerApplications?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canApproveShopUpdates?: boolean;
}
