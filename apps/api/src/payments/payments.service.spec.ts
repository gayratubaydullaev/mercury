import { createHash } from 'crypto';
import { PaymentsService } from './payments.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { OrdersService } from '../orders/orders.service';

function clickSignAction1(
  clickTransId: string,
  serviceId: string,
  secret: string,
  merchantTransId: string,
  amount: string,
  signTime: string,
) {
  const parts = [clickTransId, serviceId, secret, merchantTransId, amount, '1', signTime];
  return createHash('md5').update(parts.join('')).digest('hex');
}

describe('PaymentsService handleClickCallback (order path idempotency)', () => {
  let service: PaymentsService;
  const prismaMock = {
    order: { findFirst: jest.fn() },
    payment: { updateMany: jest.fn() },
    checkoutSession: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  } as unknown as PrismaService;
  const ordersServiceMock = {
    createOrderFromCheckoutSession: jest.fn(),
    appendOrderAudit: jest.fn(),
  } as unknown as OrdersService;
  const telegramMock = {
    sendOrderNotification: jest.fn().mockResolvedValue(undefined),
    sendAdminOrderNotification: jest.fn().mockResolvedValue(undefined),
  } as unknown as TelegramService;

  beforeEach(() => {
    jest.clearAllMocks();
    const config = {
      get: (k: string) => (k === 'CLICK_SECRET_KEY' ? 'secret' : undefined),
    } as unknown as ConfigService;
    service = new PaymentsService(prismaMock, config, telegramMock, ordersServiceMock);
  });

  it('returns success without mutating when order is already PAID (Click complete retry)', async () => {
    (prismaMock.order.findFirst as jest.Mock).mockResolvedValue({
      id: 'order-1',
      orderNumber: 'ORD-1',
      totalAmount: 100,
      paymentMethod: 'CLICK',
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
      sellerId: 'seller-1',
    });

    const signTime = '2020-01-01 00:00:00';
    const body = {
      click_trans_id: 'ct-1',
      service_id: 'svc',
      merchant_trans_id: 'ORD-1',
      amount: '100',
      action: '1',
      sign_string: clickSignAction1('ct-1', 'svc', 'secret', 'ORD-1', '100', signTime),
      sign_time: signTime,
    };

    const result = await service.handleClickCallback(body);
    expect(result.error).toBe(0);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(ordersServiceMock.appendOrderAudit).not.toHaveBeenCalled();
  });
});
