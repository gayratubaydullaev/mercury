import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SellerApplicationService } from './seller-application.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApplySellerDto } from './dto/apply-seller.dto';

@ApiTags('seller-application')
@Controller('seller-application')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SellerApplicationController {
  constructor(private readonly service: SellerApplicationService) {}

  @Post('apply')
  @ApiOperation({ summary: 'Submit application to become a seller' })
  apply(@CurrentUser('id') userId: string, @Body() dto: ApplySellerDto) {
    return this.service.apply(userId, dto);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my seller application status' })
  getMyStatus(@CurrentUser('id') userId: string) {
    return this.service.getMyStatus(userId);
  }
}
