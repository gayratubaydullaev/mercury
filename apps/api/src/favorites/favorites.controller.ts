import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('favorites')
@Controller('favorites')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FavoritesController {
  constructor(private favorites: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'List my favorites' })
  findAll(@CurrentUser('id') userId: string) {
    return this.favorites.findAll(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Add to favorites' })
  add(@CurrentUser('id') userId: string, @Body('productId') productId: string) {
    return this.favorites.add(userId, productId);
  }

  @Delete(':productId')
  @ApiOperation({ summary: 'Remove from favorites' })
  remove(@CurrentUser('id') userId: string, @Param('productId') productId: string) {
    return this.favorites.remove(userId, productId);
  }
}
