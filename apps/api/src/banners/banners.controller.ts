import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BannersService } from './banners.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('banners')
@Controller('banners')
export class BannersController {
  constructor(private banners: BannersService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List active banners (public)' })
  getActive() {
    return this.banners.getActive();
  }
}
