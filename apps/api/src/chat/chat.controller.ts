import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private chat: ChatService) {}

  @Get('sessions')
  @ApiOperation({ summary: 'My chat sessions' })
  getSessions(@CurrentUser('id') userId: string, @Query('as') as?: string) {
    return this.chat.getMySessions(userId, as !== 'seller');
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get session by id' })
  getSession(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.chat.getSession(id, userId);
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Get or create session with seller' })
  getOrCreateSession(
    @CurrentUser('id') userId: string,
    @Body() body: { sellerId: string; productId?: string }
  ) {
    return this.chat.getOrCreateSession(userId, body.sellerId, body.productId);
  }

  @Get('sessions/:id/messages')
  @ApiOperation({ summary: 'Get messages' })
  getMessages(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.chat.getMessages(id, userId);
  }

  @Post('sessions/:id/messages')
  @ApiOperation({ summary: 'Send message' })
  sendMessage(@Param('id') id: string, @CurrentUser('id') userId: string, @Body('content') content: string) {
    return this.chat.sendMessage(id, userId, content);
  }
}