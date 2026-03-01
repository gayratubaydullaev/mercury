import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { createHmac, createHash } from 'crypto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private telegram: TelegramService,
  ) {}

  async createClickPayment(orderId: string, returnUrl: string): Promise<{ redirectUrl: string }> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.paymentMethod !== 'CLICK') throw new BadRequestException('Order is not for Click');
    const amount = Math.round(Number(order.totalAmount));
    const merchantId = this.config.get('CLICK_MERCHANT_ID');
    const serviceId = this.config.get('CLICK_SERVICE_ID');
    const secretKey = this.config.get('CLICK_SECRET_KEY');
    if (!merchantId || !serviceId || !secretKey) throw new BadRequestException('Click not configured');
    const merchantTransId = order.orderNumber;
    const signString = createHmac('sha1', secretKey)
      .update(merchantTransId + serviceId + secretKey + amount + '0' + '0' + returnUrl)
      .digest('hex');
    const params = new URLSearchParams({
      service_id: serviceId,
      merchant_trans_id: merchantTransId,
      amount: String(amount),
      return_url: returnUrl,
      sign_string: signString,
    });
    await this.prisma.payment.create({
      data: { orderId, provider: 'CLICK', amount: order.totalAmount, status: 'PENDING' },
    });
    return { redirectUrl: `https://my.click.uz/services/pay?${params.toString()}` };
  }

  /**
   * Verify Click callback sign_string.
   * Prepare (action=0): MD5(click_trans_id + service_id + secret_key + merchant_trans_id + amount + action + sign_time)
   * Complete (action=1): MD5(click_trans_id + service_id + secret_key + merchant_trans_id + merchant_prepare_id + amount + action + sign_time)
   */
  private verifyClickSign(body: Record<string, string>, secretKey: string): boolean {
    const { click_trans_id, service_id, merchant_trans_id, merchant_prepare_id, amount, action, sign_string, sign_time } = body;
    if (!sign_string || !sign_time) return false;
    const parts =
      action === '1'
        ? [click_trans_id, service_id, secretKey, merchant_trans_id, merchant_prepare_id ?? '', amount, action, sign_time]
        : [click_trans_id, service_id, secretKey, merchant_trans_id, amount, action, sign_time];
    const expected = createHash('md5')
      .update(parts.join(''))
      .digest('hex');
    return expected === sign_string;
  }

  async handleClickCallback(body: Record<string, string>): Promise<Record<string, number | string>> {
    const { click_trans_id, service_id, merchant_trans_id, amount, action, sign_string, sign_time } = body;
    const secretKey = this.config.get('CLICK_SECRET_KEY');
    if (!secretKey) return { error: -8, error_note: 'Invalid config' };
    if (!this.verifyClickSign(body, secretKey)) {
      this.logger.warn(`Click callback invalid sign_string for merchant_trans_id=${merchant_trans_id}`);
      return { error: -1, error_note: 'Invalid sign_string' };
    }
    const order = await this.prisma.order.findFirst({ where: { orderNumber: merchant_trans_id } });
    if (!order) return { error: -5, error_note: 'Order not found' };
    if (Number(amount) !== Math.round(Number(order.totalAmount))) return { error: -2, error_note: 'Invalid amount' };
    if (action === '0') {
      return { click_trans_id, merchant_trans_id, merchant_prepare_id: order.id, error: 0, error_note: 'Success' };
    }
    if (action === '1') {
      await this.prisma.$transaction([
        this.prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID', status: 'CONFIRMED' } }),
        this.prisma.payment.updateMany({ where: { orderId: order.id, provider: 'CLICK' }, data: { status: 'PAID', externalId: click_trans_id } }),
      ]);
      const orderWithDetails = await this.prisma.order.findUnique({
        where: { id: order.id },
        include: {
          items: { include: { product: { select: { title: true } }, variant: { select: { options: true } } } as const },
          buyer: { select: { firstName: true, lastName: true, email: true, phone: true } },
          seller: { select: { firstName: true, lastName: true, shop: { select: { name: true } } } },
        },
      });
      if (orderWithDetails) {
        this.telegram.sendOrderNotification(order.sellerId, orderWithDetails, 'status_updated', 'CONFIRMED').catch(() => {});
        this.telegram.sendAdminOrderNotification(orderWithDetails, 'status_updated', 'CONFIRMED').catch(() => {});
      }
      this.logger.log(`Click payment completed orderId=${order.id} click_trans_id=${click_trans_id}`);
      return {
        click_trans_id,
        merchant_trans_id,
        merchant_prepare_id: order.id,
        merchant_confirm_id: order.id,
        error: 0,
        error_note: 'Success',
      };
    }
    return { error: -8, error_note: 'Invalid action' };
  }

  async createPaymePayment(orderId: string, returnUrl: string): Promise<{ paymentUrl: string }> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.paymentMethod !== 'PAYME') throw new BadRequestException('Order is not for Payme');
    // Payme API requires amount in tiyin (1 sum = 100 tiyin)
    const amountTiyin = Math.round(Number(order.totalAmount) * 100);
    const merchantId = this.config.get('PAYME_MERCHANT_ID');
    const key = this.config.get('PAYME_KEY');
    if (!merchantId || !key) throw new BadRequestException('Payme not configured');
    const params = Buffer.from(
      `m=${merchantId};ac.order_id=${orderId};a=${amountTiyin};c=${returnUrl}`,
      'utf-8',
    ).toString('base64');
    await this.prisma.payment.create({
      data: { orderId, provider: 'PAYME', amount: order.totalAmount, status: 'PENDING' },
    });
    return { paymentUrl: `https://checkout.paycom.uz/${params}` };
  }

  async handlePaymeCallback(body: { method: string; params: Record<string, unknown> }): Promise<Record<string, unknown>> {
    const { method, params } = body;
    const key = this.config.get('PAYME_KEY');
    if (!key) return { error: { code: -31050, message: 'Invalid config' } };
    if (method === 'CheckPerformTransaction') {
      const orderId = String((params?.account as { order_id?: string })?.order_id ?? '');
      const order = await this.prisma.order.findUnique({ where: { id: orderId } });
      if (!order) return { result: { allow: false, cause: { code: -31050, message: 'Order not found' } } };
      if (order.paymentStatus === 'PAID') return { result: { allow: false, cause: { code: -31050, message: 'Order already paid' } } };
      const amountTiyin = Number(params?.amount);
      const expectedTiyin = Math.round(Number(order.totalAmount) * 100);
      if (amountTiyin !== expectedTiyin) return { result: { allow: false, cause: { code: -31001, message: 'Invalid amount' } } };
      return { result: { allow: true } };
    }
    if (method === 'PerformTransaction') {
      const orderId = String((params?.account as { order_id?: string })?.order_id ?? '');
      const payment = await this.prisma.payment.findFirst({ where: { orderId, provider: 'PAYME' } });
      if (!payment) return { error: { code: -31050, message: 'Transaction not found' } };
      const order = await this.prisma.order.findUnique({ where: { id: orderId } });
      if (!order) return { error: { code: -31050, message: 'Order not found' } };
      if (order.paymentStatus !== 'PAID') {
        await this.prisma.$transaction([
          this.prisma.order.update({ where: { id: orderId }, data: { paymentStatus: 'PAID', status: 'CONFIRMED' } }),
          this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'PAID', externalId: String(params?.id ?? '') } }),
        ]);
        const orderWithDetails = await this.prisma.order.findUnique({
          where: { id: orderId },
          include: {
            items: { include: { product: { select: { title: true } }, variant: { select: { options: true } } } as const },
            buyer: { select: { firstName: true, lastName: true, email: true, phone: true } },
            seller: { select: { firstName: true, lastName: true, shop: { select: { name: true } } } },
          },
        });
        if (orderWithDetails) {
          this.telegram.sendOrderNotification(order.sellerId, orderWithDetails, 'status_updated', 'CONFIRMED').catch(() => {});
          this.telegram.sendAdminOrderNotification(orderWithDetails, 'status_updated', 'CONFIRMED').catch(() => {});
        }
        this.logger.log(`Payme payment completed orderId=${orderId}`);
      }
      return { result: { transaction: params?.transaction ?? params?.id ?? 0, state: 2 } };
    }
    return { error: { code: -32601, message: 'Method not found' } };
  }
}
