import { BadRequestException, Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private payments: PaymentsService,
    private config: ConfigService,
  ) {}

  @Post('click/init')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async clickInit(
    @CurrentUser('id') _userId: string,
    @Body() body: { sessionId?: string; orderId?: string; returnUrl: string },
  ) {
    const id = body.sessionId ?? body.orderId;
    if (!id || !body.returnUrl) throw new BadRequestException('sessionId or orderId and returnUrl required');
    return this.payments.createClickPayment(id, body.returnUrl);
  }

  @Post('payme/init')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async paymeInit(
    @CurrentUser('id') _userId: string,
    @Body() body: { sessionId?: string; orderId?: string; returnUrl: string },
  ) {
    const id = body.sessionId ?? body.orderId;
    if (!id || !body.returnUrl) throw new BadRequestException('sessionId or orderId and returnUrl required');
    return this.payments.createPaymePayment(id, body.returnUrl);
  }

  @Post('click/callback')
  @Public()
  @ApiOperation({ summary: 'Click webhook (do not call directly)' })
  async clickCallback(@Req() req: Request, @Res() res: Response) {
    const body = typeof req.body === 'object' ? req.body : {};
    const result = await this.payments.handleClickCallback(body as Record<string, string>);
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(result);
  }

  @Post('payme/callback')
  @Public()
  @ApiOperation({ summary: 'Payme webhook (do not call directly)' })
  async paymeCallback(@Req() req: Request, @Body() body: { method: string; params: Record<string, unknown> }, @Res() res: Response) {
    // Payme sends Authorization: Basic base64(merchant_id:key)
    const authHeader = req.headers.authorization;
    const merchantId = this.config.get('PAYME_MERCHANT_ID');
    const key = this.config.get('PAYME_KEY');
    if (!merchantId || !key) {
      res.setHeader('Content-Type', 'application/json');
      res.status(401).json({ error: { code: -31050, message: 'Invalid config' } });
      return;
    }
    const expected = Buffer.from(`${merchantId}:${key}`, 'utf-8').toString('base64');
    const received = authHeader?.startsWith('Basic ') ? authHeader.slice(6).trim() : '';
    if (received !== expected) {
      res.setHeader('Content-Type', 'application/json');
      res.status(401).json({ error: { code: -32504, message: 'Unauthorized' } });
      return;
    }
    const result = await this.payments.handlePaymeCallback(body);
    res.setHeader('Content-Type', 'application/json');
    // JSON-RPC 2.0: response must contain the same "id" as the request
    const requestId = (body as unknown as { id?: unknown }).id;
    const response = requestId !== undefined ? { ...result, id: requestId } : result;
    res.status(200).json(response);
  }
}
