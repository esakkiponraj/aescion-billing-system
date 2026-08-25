import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RazorpayService } from '../src/modules/payments/razorpay.service';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { PrismaService } from '../src/database/prisma.service';
import { PresenceGateway } from '../src/modules/presence/presence.gateway';
import * as crypto from 'crypto';

describe('RazorpayService & PaymentsService', () => {
  let razorpayService: RazorpayService;
  let paymentsService: PaymentsService;
  const mockKeyId = 'rzp_test_mockKeyId12345';
  const mockKeySecret = 'mockSecretKeyForTesting12345';
  const mockWebhookSecret = 'mockWebhookSecret12345';

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'RAZORPAY_KEY_ID') return mockKeyId;
      if (key === 'RAZORPAY_KEY_SECRET') return mockKeySecret;
      if (key === 'RAZORPAY_WEBHOOK_SECRET') return mockWebhookSecret;
      return null;
    }),
  };

  const mockPrismaService = {
    organization: {
      findUnique: jest.fn(),
    },
    saleInvoice: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    paymentAttempt: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    receipt: {
      create: jest.fn(),
    },
    customer: {
      update: jest.fn(),
    },
    registerSession: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async (cb) => cb(mockPrismaService)),
  };

  const mockPresenceGateway = {
    broadcastEvent: jest.fn(),
    broadcastCashierPresence: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RazorpayService,
        PaymentsService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PresenceGateway, useValue: mockPresenceGateway },
      ],
    }).compile();

    razorpayService = module.get<RazorpayService>(RazorpayService);
    paymentsService = module.get<PaymentsService>(PaymentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Cryptographic Signature Verification', () => {
    it('should accurately verify a valid Razorpay payment signature', () => {
      const orderId = 'order_DEF456GHI789';
      const paymentId = 'pay_JKL012MNO345';
      const expectedSignature = crypto
        .createHmac('sha256', mockKeySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const isValid = razorpayService.verifyPaymentSignature(
        orderId,
        paymentId,
        expectedSignature,
      );
      expect(isValid).toBe(true);
    });

    it('should reject a tampered or invalid Razorpay payment signature', () => {
      const orderId = 'order_DEF456GHI789';
      const paymentId = 'pay_JKL012MNO345';
      const fakeSignature = 'bad_signature_tampered_hex_1234567890abcdef1234567890abcdef12345678';

      const isValid = razorpayService.verifyPaymentSignature(
        orderId,
        paymentId,
        fakeSignature,
      );
      expect(isValid).toBe(false);
    });

    it('should accurately verify a valid Razorpay webhook signature', () => {
      const rawPayload = JSON.stringify({ event: 'payment.captured', entity: 'event' });
      const expectedSignature = crypto
        .createHmac('sha256', mockWebhookSecret)
        .update(rawPayload)
        .digest('hex');

      const isValid = razorpayService.verifyWebhookSignature(rawPayload, expectedSignature);
      expect(isValid).toBe(true);
    });
  });

  describe('Order Creation & Balance Validation', () => {
    const tenantContext: any = {
      organizationId: 'org_test_123',
      outletId: 'outlet_test_123',
      roles: ['CASHIER'],
    };

    it('should reject order creation if invoice is not found in organization', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue({ id: 'org_test_123', name: 'Test Org' });
      mockPrismaService.saleInvoice.findFirst.mockResolvedValue(null);

      await expect(
        paymentsService.createCheckoutOrder(tenantContext, { invoiceId: 'non-existent-id' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject order creation if requested partial amount exceeds outstanding balance', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue({ id: 'org_test_123', name: 'Test Org' });
      mockPrismaService.saleInvoice.findFirst.mockResolvedValue({
        id: 'inv_123',
        invoiceNumber: 'INV-2026-001',
        totalAmount: 1000,
        paidAmount: 500,
        outstandingAmount: 500,
        paymentStatus: 'PARTIALLY_PAID',
      });

      await expect(
        paymentsService.createCheckoutOrder(tenantContext, {
          invoiceId: 'inv_123',
          amount: 600, // Exceeds 500
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Webhook Processing & Idempotency', () => {
    it('should ignore duplicate webhook event without re-processing', async () => {
      const eventId = 'evt_duplicate12345';
      const rawPayload = JSON.stringify({
        event: 'payment.captured',
        event_id: eventId,
        payload: { payment: { entity: { id: 'pay_123', order_id: 'order_123' } } },
      });

      const signature = crypto
        .createHmac('sha256', mockWebhookSecret)
        .update(rawPayload)
        .digest('hex');

      mockPrismaService.webhookEvent = {
        findUnique: jest.fn().mockResolvedValue({
          id: 'existing-id',
          eventId,
          processedStatus: 'PROCESSED',
        }),
        create: jest.fn(),
      };

      const result = await paymentsService.processWebhookEvent(rawPayload, signature, eventId);
      expect(result.success).toBe(true);
      expect(result.message).toContain('already processed');
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should reject webhook with invalid signature', async () => {
      const rawPayload = JSON.stringify({ event: 'payment.captured' });
      const badSignature = 'invalid_tampered_signature_hex_1234567890abcdef1234567890abcdef1234';

      await expect(
        paymentsService.processWebhookEvent(rawPayload, badSignature, 'evt_bad_sig'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Refunds & Reconciliation', () => {
    it('should deny refund initiation if user has only CASHIER role', async () => {
      const cashierContext: any = {
        organizationId: 'org_test_123',
        roles: ['CASHIER'],
        userId: 'cashier_user_1',
      };

      await expect(
        paymentsService.initiateRefund(cashierContext, {
          paymentAttemptId: 'attempt_123',
          amount: 100,
        }),
      ).rejects.toThrow();
    });

    it('should reject refund if requested amount exceeds captured balance', async () => {
      const ownerContext: any = {
        organizationId: 'org_test_123',
        roles: ['OWNER'],
        userId: 'owner_user_1',
      };

      mockPrismaService.paymentAttempt.findFirst.mockResolvedValue({
        id: 'attempt_123',
        organizationId: 'org_test_123',
        status: 'CAPTURED',
        expectedAmount: 500,
        razorpayPaymentId: 'pay_captured_123',
        refunds: [{ id: 'ref_1', amount: 300, status: 'PROCESSED' }],
      });

      await expect(
        paymentsService.initiateRefund(ownerContext, {
          paymentAttemptId: 'attempt_123',
          amount: 300, // 500 - 300 = 200 max refundable, so 300 must fail
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});


