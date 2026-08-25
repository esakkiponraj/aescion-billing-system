import { Injectable, Logger, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private razorpayInstance: Razorpay | null = null;
  private keyId: string;
  private keySecret: string;
  private webhookSecret: string;

  constructor(private configService: ConfigService) {
    this.keyId = this.configService.get<string>('RAZORPAY_KEY_ID', process.env.RAZORPAY_KEY_ID || '');
    this.keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET', process.env.RAZORPAY_KEY_SECRET || '');
    this.webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET', process.env.RAZORPAY_WEBHOOK_SECRET || '');

    if (this.keyId && this.keySecret) {
      try {
        const RazorpayClass =
          typeof Razorpay === 'function'
            ? Razorpay
            : (Razorpay as any)?.default || require('razorpay');
        this.razorpayInstance = new RazorpayClass({
          key_id: this.keyId,
          key_secret: this.keySecret,
        });
        this.logger.log(`RazorpayService initialized successfully (Key ID: ${this.keyId.substring(0, 8)}...)`);
      } catch (err: any) {
        this.logger.error(`Failed to initialize Razorpay SDK: ${err.message}`);
      }
    } else {
      this.logger.warn('Razorpay credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not configured.');
    }
  }

  getKeyId(): string {
    return this.keyId || process.env.RAZORPAY_KEY_ID || '';
  }

  isConfigured(): boolean {
    return Boolean(this.keyId && this.keySecret && this.razorpayInstance);
  }

  /**
   * Create a new Order in Razorpay.
   * Amount must be in paise (1 INR = 100 paise).
   */
  async createOrder(
    amountInPaise: number,
    receiptNumber: string,
    notes?: Record<string, string>,
  ): Promise<{ id: string; amount: number; currency: string }> {
    if (!this.razorpayInstance) {
      // Re-attempt initialization if environment variables became available
      this.keyId = this.configService.get<string>('RAZORPAY_KEY_ID', process.env.RAZORPAY_KEY_ID || '');
      this.keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET', process.env.RAZORPAY_KEY_SECRET || '');
      if (this.keyId && this.keySecret) {
        const RazorpayClass =
          typeof Razorpay === 'function'
            ? Razorpay
            : (Razorpay as any)?.default || require('razorpay');
        this.razorpayInstance = new RazorpayClass({
          key_id: this.keyId,
          key_secret: this.keySecret,
        });
      } else {
        throw new InternalServerErrorException('Razorpay is not configured on this server. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
      }
    }

    try {
      const order = await this.razorpayInstance.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: receiptNumber.substring(0, 40), // Razorpay receipt max 40 chars
        notes: notes || {},
      });

      this.logger.log(`Razorpay Order created: ${order.id} for amount ${amountInPaise} paise (Receipt: ${receiptNumber})`);
      return {
        id: order.id,
        amount: Number(order.amount),
        currency: order.currency,
      };
    } catch (err: any) {
      this.logger.error(`Razorpay order creation failed: ${err.message}`, err.stack);
      throw new BadRequestException(`Failed to create Razorpay Order: ${err?.error?.description || err.message}`);
    }
  }

  /**
   * Verify the cryptographic HMAC-SHA256 signature returned by Razorpay Standard Checkout.
   */
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    if (!signature || typeof signature !== 'string') return false;

    if (!this.keySecret) {
      this.keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET', process.env.RAZORPAY_KEY_SECRET || '');
    }
    if (!this.keySecret) {
      this.logger.error('Cannot verify signature: RAZORPAY_KEY_SECRET is missing.');
      return false;
    }

    try {
      const body = `${orderId}|${paymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.keySecret)
        .update(body)
        .digest('hex');

      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const signatureBuffer = Buffer.from(signature, 'utf8');

      if (expectedBuffer.length !== signatureBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
    } catch (err: any) {
      this.logger.error(`Signature verification error: ${err.message}`);
      return false;
    }
  }

  /**
   * Verify the webhook signature against RAZORPAY_WEBHOOK_SECRET.
   */
  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    if (!signature || typeof signature !== 'string') return false;

    const webhookSecret =
      this.webhookSecret ||
      this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET', process.env.RAZORPAY_WEBHOOK_SECRET || '');

    if (!webhookSecret) {
      this.logger.error('Cannot verify webhook: RAZORPAY_WEBHOOK_SECRET is missing.');
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const signatureBuffer = Buffer.from(signature, 'utf8');

      if (expectedBuffer.length !== signatureBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
    } catch (err: any) {
      this.logger.error(`Webhook signature verification error: ${err.message}`);
      return false;
    }
  }

  /**
   * Fetch payment details from Razorpay API to confirm capture status.
   */
  async fetchPayment(paymentId: string): Promise<any> {
    if (!this.razorpayInstance) {
      throw new InternalServerErrorException('Razorpay SDK is not initialized.');
    }

    try {
      return await this.razorpayInstance.payments.fetch(paymentId);
    } catch (err: any) {
      this.logger.error(`Failed to fetch payment ${paymentId}: ${err.message}`);
      throw new BadRequestException(`Could not retrieve Razorpay payment: ${err?.error?.description || err.message}`);
    }
  }

  /**
   * Create a full or partial refund via Razorpay Refund API.
   */
  async createRefund(
    paymentId: string,
    amountInPaise: number,
    notes?: Record<string, string>,
  ): Promise<any> {
    if (!this.razorpayInstance) {
      throw new InternalServerErrorException('Razorpay SDK is not initialized.');
    }

    try {
      const refund = await this.razorpayInstance.payments.refund(paymentId, {
        amount: amountInPaise,
        notes: notes || {},
      });

      this.logger.log(`Razorpay Refund created: ${refund.id} for payment ${paymentId} (Amount: ${amountInPaise} paise)`);
      return refund;
    } catch (err: any) {
      this.logger.error(`Razorpay refund failed for payment ${paymentId}: ${err.message}`, err.stack);
      throw new BadRequestException(`Failed to process refund in Razorpay: ${err?.error?.description || err.message}`);
    }
  }
}
