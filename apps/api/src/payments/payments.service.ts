import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { OrdersService } from '../orders/orders.service';
import { createHmac, createHash } from 'crypto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isSessionId(id: string): boolean {
  return UUID_REGEX.test(id);
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private telegram: TelegramService,
    private ordersService: OrdersService,
  ) {}

  async createClickPayment(sessionIdOrOrderId: string, returnUrl: string): Promise<{ redirectUrl: string }> {
    const serviceId = this.config.get('CLICK_SERVICE_ID');
    const secretKey = this.config.get('CLICK_SECRET_KEY');
    if (!serviceId || !secretKey) throw new BadRequestException('Click not configured');

    let merchantTransId: string;
    let amount: number;

    if (isSessionId(sessionIdOrOrderId)) {
      const session = await this.prisma.checkoutSession.findUnique({ where: { id: sessionIdOrOrderId } });
      if (!session) throw new NotFoundException('Checkout session not found');
      if (session.paymentMethod !== 'CLICK') throw new BadRequestException('Session is not for Click');
      merchantTransId = sessionIdOrOrderId;
      amount = Math.round(Number(session.totalAmount));
    } else {
      const order = await this.prisma.order.findUnique({ where: { id: sessionIdOrOrderId } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.paymentMethod !== 'CLICK') throw new BadRequestException('Order is not for Click');
      merchantTransId = order.orderNumber;
      amount = Math.round(Number(order.totalAmount));
      await this.prisma.payment.create({
        data: { orderId: order.id, provider: 'CLICK', amount: order.totalAmount, status: 'PENDING' },
      });
    }

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
    return { redirectUrl: `https://my.click.uz/services/pay?${params.toString()}` };
  }

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
    const { click_trans_id, merchant_trans_id, amount, action } = body;
    const secretKey = this.config.get('CLICK_SECRET_KEY');
    if (!secretKey) return { error: -8, error_note: 'Invalid config' };
    if (!this.verifyClickSign(body, secretKey)) {
      this.logger.warn(`Click callback invalid sign_string for merchant_trans_id=${merchant_trans_id}`);
      return { error: -1, error_note: 'Invalid sign_string' };
    }

    if (isSessionId(merchant_trans_id)) {
      const session = await this.prisma.checkoutSession.findUnique({ where: { id: merchant_trans_id } });
      if (!session) return { error: -5, error_note: 'Session not found' };
      if (Number(amount) !== Math.round(Number(session.totalAmount))) return { error: -2, error_note: 'Invalid amount' };
      if (action === '0') {
        return { click_trans_id, merchant_trans_id, merchant_prepare_id: merchant_trans_id, error: 0, error_note: 'Success' };
      }
      if (action === '1') {
        const order = await this.ordersService.createOrderFromCheckoutSession(merchant_trans_id, 'CLICK', click_trans_id);
        this.logger.log(`Click payment completed (session) orderId=${order.id} click_trans_id=${click_trans_id}`);
        return {
          click_trans_id,
          merchant_trans_id,
          merchant_prepare_id: merchant_trans_id,
          merchant_confirm_id: order.id,
          error: 0,
          error_note: 'Success',
        };
      }
      return { error: -8, error_note: 'Invalid action' };
    }

    const order = await this.prisma.order.findFirst({ where: { orderNumber: merchant_trans_id } });
    if (!order) return { error: -5, error_note: 'Order not found' };
    if (Number(amount) !== Math.round(Number(order.totalAmount))) return { error: -2, error_note: 'Invalid amount' };
    if (action === '0') {
      return { click_trans_id, merchant_trans_id, merchant_prepare_id: order.id, error: 0, error_note: 'Success' };
    }
    if (action === '1') {
      if (order.paymentStatus === 'PAID') {
        this.logger.log(
          `Click callback idempotent complete orderId=${order.id} click_trans_id=${click_trans_id} (already PAID)`,
        );
        return {
          click_trans_id,
          merchant_trans_id,
          merchant_prepare_id: order.id,
          merchant_confirm_id: order.id,
          error: 0,
          error_note: 'Success',
        };
      }
      const fromStatus = order.status;
      const fromPaymentStatus = order.paymentStatus;
      await this.prisma.$transaction([
        this.prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID', status: 'CONFIRMED' } }),
        this.prisma.payment.updateMany({ where: { orderId: order.id, provider: 'CLICK' }, data: { status: 'PAID', externalId: click_trans_id } }),
      ]);
      this.ordersService.appendOrderAudit(order.id, null, 'GATEWAY_MARK_PAID', {
        provider: 'CLICK',
        externalId: click_trans_id,
        fromPaymentStatus,
        toPaymentStatus: 'PAID',
        fromStatus,
        toStatus: 'CONFIRMED',
      });
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

  async createPaymePayment(sessionIdOrOrderId: string, returnUrl: string): Promise<{ paymentUrl: string }> {
    const merchantId = this.config.get('PAYME_MERCHANT_ID');
    if (!merchantId) throw new BadRequestException('Payme not configured');

    let amountTiyin: number;
    if (isSessionId(sessionIdOrOrderId)) {
      const session = await this.prisma.checkoutSession.findUnique({ where: { id: sessionIdOrOrderId } });
      if (!session) throw new NotFoundException('Checkout session not found');
      if (session.paymentMethod !== 'PAYME') throw new BadRequestException('Session is not for Payme');
      amountTiyin = Math.round(Number(session.totalAmount) * 100);
    } else {
      const order = await this.prisma.order.findUnique({ where: { id: sessionIdOrOrderId } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.paymentMethod !== 'PAYME') throw new BadRequestException('Order is not for Payme');
      amountTiyin = Math.round(Number(order.totalAmount) * 100);
      await this.prisma.payment.create({
        data: { orderId: order.id, provider: 'PAYME', amount: order.totalAmount, status: 'PENDING' },
      });
    }
    const params = Buffer.from(
      `m=${merchantId};ac.order_id=${sessionIdOrOrderId};a=${amountTiyin};c=${returnUrl}`,
      'utf-8',
    ).toString('base64');
    return { paymentUrl: `https://checkout.paycom.uz/${params}` };
  }

  async handlePaymeCallback(body: { method: string; params: Record<string, unknown> }): Promise<Record<string, unknown>> {
    const { method, params } = body;
    const accountOrderId = String((params?.account as { order_id?: string })?.order_id ?? '');
    const isSession = isSessionId(accountOrderId);

    if (method === 'CheckPerformTransaction') {
      if (isSession) {
        const session = await this.prisma.checkoutSession.findUnique({ where: { id: accountOrderId } });
        if (!session) return { result: { allow: false, cause: { code: -31050, message: 'Session not found' } } };
        if (session.orderId) return { result: { allow: false, cause: { code: -31050, message: 'Order already paid' } } };
        const amountTiyin = Number(params?.amount);
        const expectedTiyin = Math.round(Number(session.totalAmount) * 100);
        if (amountTiyin !== expectedTiyin) return { result: { allow: false, cause: { code: -31001, message: 'Invalid amount' } } };
        return { result: { allow: true } };
      }
      const order = await this.prisma.order.findUnique({ where: { id: accountOrderId } });
      if (!order) return { result: { allow: false, cause: { code: -31050, message: 'Order not found' } } };
      if (order.paymentStatus === 'PAID') return { result: { allow: false, cause: { code: -31050, message: 'Order already paid' } } };
      const amountTiyin = Number(params?.amount);
      const expectedTiyin = Math.round(Number(order.totalAmount) * 100);
      if (amountTiyin !== expectedTiyin) return { result: { allow: false, cause: { code: -31001, message: 'Invalid amount' } } };
      return { result: { allow: true } };
    }
    if (method === 'PerformTransaction') {
      if (isSession) {
        const session = await this.prisma.checkoutSession.findUnique({ where: { id: accountOrderId } });
        if (!session) return { error: { code: -31050, message: 'Session not found' } };
        const order = await this.ordersService.createOrderFromCheckoutSession(
          accountOrderId,
          'PAYME',
          String(params?.id ?? params?.transaction ?? ''),
        );
        this.logger.log(`Payme payment completed (session) orderId=${order.id}`);
        return { result: { transaction: params?.transaction ?? params?.id ?? 0, state: 2 } };
      }
      const payment = await this.prisma.payment.findFirst({ where: { orderId: accountOrderId, provider: 'PAYME' } });
      if (!payment) return { error: { code: -31050, message: 'Transaction not found' } };
      const order = await this.prisma.order.findUnique({ where: { id: accountOrderId } });
      if (!order) return { error: { code: -31050, message: 'Order not found' } };
      if (order.paymentStatus !== 'PAID') {
        const fromStatus = order.status;
        const fromPaymentStatus = order.paymentStatus;
        await this.prisma.$transaction([
          this.prisma.order.update({ where: { id: accountOrderId }, data: { paymentStatus: 'PAID', status: 'CONFIRMED' } }),
          this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'PAID', externalId: String(params?.id ?? '') } }),
        ]);
        this.ordersService.appendOrderAudit(accountOrderId, null, 'GATEWAY_MARK_PAID', {
          provider: 'PAYME',
          externalId: String(params?.id ?? ''),
          fromPaymentStatus,
          toPaymentStatus: 'PAID',
          fromStatus,
          toStatus: 'CONFIRMED',
        });
        const orderWithDetails = await this.prisma.order.findUnique({
          where: { id: accountOrderId },
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
        this.logger.log(`Payme payment completed orderId=${accountOrderId}`);
      }
      return { result: { transaction: params?.transaction ?? params?.id ?? 0, state: 2 } };
    }
    return { error: { code: -32601, message: 'Method not found' } };
  }
}
