import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RazorpayService } from './razorpay.service';
import { PresenceGateway } from '../presence/presence.gateway';
import { generateDocumentNumber } from '../finance/quotations.service';
import { CreateRazorpayOrderDto } from './dto/create-razorpay-order.dto';
import { VerifyRazorpayPaymentDto } from './dto/verify-razorpay-payment.dto';
import { CreatePaymentRefundDto } from './dto/create-payment-refund.dto';
import {
  TenantContext,
  RazorpayOrderResponse,
  VerifyRazorpayPaymentResponse,
  PaymentRefundResponse,
  ReconcilePaymentAttemptResponse,
} from '@aescion/types';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private razorpayService: RazorpayService,
    private presenceGateway: PresenceGateway,
  ) {}

  /**
   * Helper to check if user has elevated owner or manager roles.
   */
  private isOwnerOrManager(tenantContext: TenantContext): boolean {
    const roles = tenantContext.roles || [];
    return (
      roles.includes('OWNER') ||
      roles.includes('MANAGER') ||
      roles.includes('SUPER_ADMIN') ||
      roles.includes('SUPER_ADMIN_SUPPORT')
    );
  }

  /**
   * Create an authenticated Razorpay Order for a specific invoice.
   * Recalculates payable balance and validates partial payment amounts safely.
   */
  async createCheckoutOrder(
    tenantContext: TenantContext,
    dto: CreateRazorpayOrderDto,
    currentUserId?: string,
  ): Promise<RazorpayOrderResponse> {
    const orgId = tenantContext.organizationId;
    const userId = currentUserId || tenantContext.userId;

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) {
      throw new NotFoundException('Organization not found.');
    }

    const invoice = await this.prisma.saleInvoice.findFirst({
      where: {
        id: dto.invoiceId,
        organizationId: orgId,
      },
      include: {
        customer: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found in your organization.');
    }

    if (invoice.paymentStatus === 'PAID' || invoice.outstandingAmount <= 0) {
      throw new BadRequestException('This invoice is already fully paid.');
    }

    // Determine and validate the exact payable amount
    let amountToPay = invoice.outstandingAmount;
    if (dto.amount !== undefined && dto.amount !== null) {
      const requested = Number(dto.amount);
      if (isNaN(requested) || requested <= 0) {
        throw new BadRequestException('Payment amount must be greater than zero.');
      }
      if (requested > invoice.outstandingAmount) {
        throw new BadRequestException(
          `Requested amount (₹${requested.toFixed(2)}) exceeds remaining balance (₹${invoice.outstandingAmount.toFixed(2)}).`,
        );
      }
      amountToPay = requested;
    }

    // Safe integer calculation in paise
    const amountInPaise = Math.round(amountToPay * 100);
    if (amountInPaise < 100) {
      throw new BadRequestException('Minimum Razorpay payment amount is ₹1.00.');
    }

    // Check for recent pending payment attempt with same amount to prevent duplicate orders on double click
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const existingAttempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        invoiceId: invoice.id,
        organizationId: orgId,
        status: 'CREATED',
        amountInPaise,
        createdAt: { gte: tenMinutesAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    let razorpayOrderId: string;

    if (existingAttempt) {
      razorpayOrderId = existingAttempt.razorpayOrderId;
      this.logger.log(`Reusing existing uncaptured Razorpay Order ${razorpayOrderId} for invoice ${invoice.invoiceNumber}`);
    } else {
      const order = await this.razorpayService.createOrder(
        amountInPaise,
        invoice.invoiceNumber,
        {
          organizationId: orgId,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          outletId: invoice.outletId,
          userId: userId || 'unknown',
          ...(dto.notes || {}),
        },
      );
      razorpayOrderId = order.id;

      await this.prisma.paymentAttempt.create({
        data: {
          organizationId: orgId,
          outletId: invoice.outletId,
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          initiatedByUserId: userId || null,
          provider: 'RAZORPAY',
          razorpayOrderId,
          expectedAmount: amountToPay,
          amountInPaise,
          currency: 'INR',
          status: 'CREATED',
          metadata: JSON.stringify(dto.notes || {}),
        },
      });
    }

    return {
      orderId: razorpayOrderId,
      amount: amountToPay,
      amountInPaise,
      currency: 'INR',
      keyId: this.razorpayService.getKeyId(),
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customer?.name || 'Walk-in Customer',
      customerEmail: invoice.customer?.email || undefined,
      customerPhone: invoice.customer?.phone || undefined,
      businessName: org.name,
      businessLogo: org.logoUrl || undefined,
    };
  }

  /**
   * Verify Razorpay cryptographic signature and capture payment transactionally.
   */
  async verifyAndCapturePayment(
    tenantContext: TenantContext,
    dto: VerifyRazorpayPaymentDto,
    currentUserId?: string,
  ): Promise<VerifyRazorpayPaymentResponse> {
    const orgId = tenantContext.organizationId;
    const userId = currentUserId || tenantContext.userId;

    const paymentAttempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        razorpayOrderId: dto.razorpayOrderId,
        organizationId: orgId,
      },
      include: {
        invoice: true,
      },
    });

    if (!paymentAttempt) {
      throw new NotFoundException('Payment attempt not found for this organization.');
    }

    // Idempotency: If already captured, return existing success response
    if (paymentAttempt.status === 'CAPTURED') {
      this.logger.log(`Payment attempt for Order ${dto.razorpayOrderId} already captured. Returning idempotent result.`);
      const existingPayment = await this.prisma.payment.findFirst({
        where: { paymentAttemptId: paymentAttempt.id },
        include: { receipts: true },
      });

      return {
        success: true,
        paymentId: existingPayment?.id || '',
        receiptId: existingPayment?.receipts[0]?.id || '',
        receiptNumber: existingPayment?.receipts[0]?.receiptNumber || '',
        invoiceId: paymentAttempt.invoice.id,
        invoiceNumber: paymentAttempt.invoice.invoiceNumber,
        paidAmount: paymentAttempt.invoice.paidAmount,
        outstandingAmount: paymentAttempt.invoice.outstandingAmount,
        paymentStatus: paymentAttempt.invoice.paymentStatus,
      };
    }

    // Cryptographic signature check
    const isValidSignature = this.razorpayService.verifyPaymentSignature(
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.razorpaySignature,
    );

    if (!isValidSignature) {
      this.logger.warn(`Signature verification failed for Order: ${dto.razorpayOrderId}, Payment: ${dto.razorpayPaymentId}`);
      await this.prisma.paymentAttempt.update({
        where: { id: paymentAttempt.id },
        data: {
          status: 'FAILED',
          failureCode: 'INVALID_SIGNATURE',
          failureReason: 'Cryptographic signature verification failed',
        },
      });
      throw new BadRequestException('Invalid Razorpay payment signature.');
    }

    // Verify payment status and amount with Razorpay API
    const rzpPayment = await this.razorpayService.fetchPayment(dto.razorpayPaymentId);
    if (!rzpPayment || (rzpPayment.status !== 'captured' && rzpPayment.status !== 'authorized')) {
      throw new BadRequestException(`Payment is not in captured state (status: ${rzpPayment?.status || 'unknown'}).`);
    }

    if (Number(rzpPayment.amount) !== paymentAttempt.amountInPaise) {
      this.logger.error(
        `Payment amount mismatch! Expected ${paymentAttempt.amountInPaise} paise, Razorpay reports ${rzpPayment.amount} paise.`,
      );
      throw new BadRequestException('Payment amount mismatch between gateway and local attempt.');
    }

    // Execute atomic financial transaction with 30s timeout
    return this.prisma.$transaction(
      async (tx) => {
        const invoice = await tx.saleInvoice.findUnique({
          where: { id: paymentAttempt.invoiceId },
        });

        if (!invoice) {
          throw new NotFoundException('Invoice not found.');
        }

        const paymentNumber = await generateDocumentNumber(tx, orgId, 'RECEIPT');
        const activeSession = await tx.registerSession.findFirst({
          where: {
            organizationId: orgId,
            openedByUserId: userId,
            status: 'OPEN',
          },
          orderBy: { openedAt: 'desc' },
        });

        const amountPaid = paymentAttempt.expectedAmount;
        const newPaid = invoice.paidAmount + amountPaid;
        const newOutstanding = Math.max(0, invoice.totalAmount - newPaid);
        const newPaymentStatus = newOutstanding === 0 ? 'PAID' : 'PARTIALLY_PAID';

        // 1. Update Payment Attempt
        await tx.paymentAttempt.update({
          where: { id: paymentAttempt.id },
          data: {
            status: 'CAPTURED',
            razorpayPaymentId: dto.razorpayPaymentId,
            signatureVerified: true,
            paymentMethod: rzpPayment.method || 'RAZORPAY',
            capturedAt: new Date(),
          },
        });

        // 2. Create Payment record
        const payment = await tx.payment.create({
          data: {
            paymentNumber,
            organizationId: orgId,
            outletId: invoice.outletId,
            type: 'CUSTOMER_RECEIPT',
            customerId: invoice.customerId,
            invoiceId: invoice.id,
            paymentAttemptId: paymentAttempt.id,
            registerSessionId: activeSession?.id || null,
            amount: amountPaid,
            paymentMethod: 'RAZORPAY',
            referenceNumber: dto.razorpayPaymentId,
            status: 'COMPLETED',
            createdByUserId: userId || null,
            notes: dto.notes || `Razorpay Online Payment (Order: ${dto.razorpayOrderId}, Payment: ${dto.razorpayPaymentId})`,
          },
        });

        // 3. Create Receipt record
        const receipt = await tx.receipt.create({
          data: {
            receiptNumber: paymentNumber,
            organizationId: orgId,
            outletId: invoice.outletId,
            invoiceId: invoice.id,
            paymentId: payment.id,
            customerId: invoice.customerId,
            amountPaid,
            previouslyPaid: invoice.paidAmount,
            totalPaid: newPaid,
            remainingBalance: newOutstanding,
            paymentMethod: 'RAZORPAY',
            referenceNumber: dto.razorpayPaymentId,
            paymentDate: new Date(),
            status: 'ISSUED',
            notes: dto.notes || `Receipt for ${invoice.invoiceNumber} via Razorpay`,
            createdByUserId: userId || null,
          },
        });

        // 4. Update Sale Invoice balances
        const updatedInvoice = await tx.saleInvoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: newPaid,
            outstandingAmount: newOutstanding,
            paymentStatus: newPaymentStatus,
          },
        });

        // 5. Adjust customer outstanding balance if applicable
        if (invoice.customerId) {
          await tx.customer.update({
            where: { id: invoice.customerId },
            data: {
              outstandingBalance: { decrement: amountPaid },
            },
          });
        }

        // 6. Record Audit Log
        await tx.auditLog.create({
          data: {
            organizationId: orgId,
            outletId: invoice.outletId,
            userId: userId || null,
            action: 'RAZORPAY_PAYMENT_CAPTURED',
            resource: 'SaleInvoice',
            resourceId: invoice.id,
            afterState: JSON.stringify({
              invoiceNumber: invoice.invoiceNumber,
              receiptNumber: paymentNumber,
              razorpayOrderId: dto.razorpayOrderId,
              razorpayPaymentId: dto.razorpayPaymentId,
              amountPaid,
              newOutstanding,
              newPaymentStatus,
            }),
          },
        });

        // 7. Live Real-time Broadcasts
        this.presenceGateway.broadcastEvent(orgId, 'receipt:generated', {
          id: receipt.id,
          receiptNumber: receipt.receiptNumber,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amountPaid,
          paymentMethod: 'RAZORPAY',
          createdByUserId: userId,
        });

        this.presenceGateway.broadcastEvent(orgId, 'invoice:updated', {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          paidAmount: newPaid,
          outstandingAmount: newOutstanding,
          paymentStatus: newPaymentStatus,
        });

        return {
          success: true,
          paymentId: payment.id,
          receiptId: receipt.id,
          receiptNumber: receipt.receiptNumber,
          invoiceId: updatedInvoice.id,
          invoiceNumber: updatedInvoice.invoiceNumber,
          paidAmount: updatedInvoice.paidAmount,
          outstandingAmount: updatedInvoice.outstandingAmount,
          paymentStatus: updatedInvoice.paymentStatus,
        };
      },
      {
        maxWait: 10_000,
        timeout: 30_000,
      },
    );
  }

  /**
   * Get payment attempts for an invoice.
   */
  async getPaymentAttempts(tenantContext: TenantContext, invoiceId: string) {
    return this.prisma.paymentAttempt.findMany({
      where: {
        invoiceId,
        organizationId: tenantContext.organizationId,
      },
      include: {
        refunds: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Process Razorpay public Webhook events idempotently.
   */
  async processWebhookEvent(
    rawBody: Buffer | string,
    signature: string,
    eventIdHeader?: string,
    bodyJson?: any,
  ): Promise<{ success: boolean; message: string }> {
    if (!signature) {
      throw new BadRequestException('Missing x-razorpay-signature header.');
    }

    // 1. Cryptographic HMAC verification using RAZORPAY_WEBHOOK_SECRET
    const isValid = this.razorpayService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      this.logger.warn('Razorpay webhook HMAC signature verification failed.');
      throw new BadRequestException('Invalid Razorpay webhook signature.');
    }

    const payload =
      typeof bodyJson === 'object' && bodyJson !== null
        ? bodyJson
        : JSON.parse(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'));

    const eventId =
      eventIdHeader ||
      payload.event_id ||
      payload.id ||
      `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const eventType: string = payload.event || 'unknown';

    // 2. Idempotency Check
    const existingEvent = await this.prisma.webhookEvent.findUnique({
      where: { eventId },
    });

    if (existingEvent) {
      this.logger.log(
        `[Webhook] Duplicate event detected: ${eventId} (status: ${existingEvent.processedStatus}). Acknowledging without re-processing.`,
      );
      return { success: true, message: 'Event already processed' };
    }

    this.logger.log(`[Webhook] Processing event ${eventId} (${eventType})`);

    try {
      if (eventType === 'payment.captured' || eventType === 'order.paid') {
        const paymentEntity = payload.payload?.payment?.entity;
        const orderId = paymentEntity?.order_id;
        const paymentId = paymentEntity?.id;

        if (orderId && paymentId) {
          const paymentAttempt = await this.prisma.paymentAttempt.findFirst({
            where: { razorpayOrderId: orderId },
            include: { invoice: true },
          });

          if (paymentAttempt && paymentAttempt.status !== 'CAPTURED') {
            const orgId = paymentAttempt.organizationId;
            const amountPaid = paymentAttempt.expectedAmount;

            await this.prisma.$transaction(
              async (tx) => {
                const invoice = await tx.saleInvoice.findUnique({
                  where: { id: paymentAttempt.invoiceId },
                });
                if (!invoice) return;

                const paymentNumber = await generateDocumentNumber(tx, orgId, 'RECEIPT');
                const newPaid = invoice.paidAmount + amountPaid;
                const newOutstanding = Math.max(0, invoice.totalAmount - newPaid);
                const newPaymentStatus = newOutstanding === 0 ? 'PAID' : 'PARTIALLY_PAID';

                await tx.paymentAttempt.update({
                  where: { id: paymentAttempt.id },
                  data: {
                    status: 'CAPTURED',
                    razorpayPaymentId: paymentId,
                    signatureVerified: true,
                    paymentMethod: paymentEntity.method || 'RAZORPAY',
                    capturedAt: new Date(),
                  },
                });

                const payment = await tx.payment.create({
                  data: {
                    paymentNumber,
                    organizationId: orgId,
                    outletId: invoice.outletId,
                    type: 'CUSTOMER_RECEIPT',
                    customerId: invoice.customerId,
                    invoiceId: invoice.id,
                    paymentAttemptId: paymentAttempt.id,
                    amount: amountPaid,
                    paymentMethod: 'RAZORPAY',
                    referenceNumber: paymentId,
                    status: 'COMPLETED',
                    createdByUserId: paymentAttempt.initiatedByUserId || null,
                    notes: `Razorpay Webhook Confirmed (Order: ${orderId}, Payment: ${paymentId})`,
                  },
                });

                const receipt = await tx.receipt.create({
                  data: {
                    receiptNumber: paymentNumber,
                    organizationId: orgId,
                    outletId: invoice.outletId,
                    invoiceId: invoice.id,
                    paymentId: payment.id,
                    customerId: invoice.customerId,
                    amountPaid,
                    previouslyPaid: invoice.paidAmount,
                    totalPaid: newPaid,
                    remainingBalance: newOutstanding,
                    paymentMethod: 'RAZORPAY',
                    referenceNumber: paymentId,
                    paymentDate: new Date(),
                    status: 'ISSUED',
                    notes: `Receipt for ${invoice.invoiceNumber} via Razorpay Webhook`,
                    createdByUserId: paymentAttempt.initiatedByUserId || null,
                  },
                });

                await tx.saleInvoice.update({
                  where: { id: invoice.id },
                  data: {
                    paidAmount: newPaid,
                    outstandingAmount: newOutstanding,
                    paymentStatus: newPaymentStatus,
                  },
                });

                if (invoice.customerId) {
                  await tx.customer.update({
                    where: { id: invoice.customerId },
                    data: {
                      outstandingBalance: { decrement: amountPaid },
                    },
                  });
                }

                await tx.auditLog.create({
                  data: {
                    organizationId: orgId,
                    outletId: invoice.outletId,
                    userId: paymentAttempt.initiatedByUserId || null,
                    action: 'RAZORPAY_WEBHOOK_PAYMENT_CAPTURED',
                    resource: 'SaleInvoice',
                    resourceId: invoice.id,
                    afterState: JSON.stringify({
                      invoiceNumber: invoice.invoiceNumber,
                      receiptNumber: paymentNumber,
                      razorpayOrderId: orderId,
                      razorpayPaymentId: paymentId,
                      amountPaid,
                      newOutstanding,
                      newPaymentStatus,
                    }),
                  },
                });

                this.presenceGateway.broadcastEvent(orgId, 'receipt:generated', {
                  id: receipt.id,
                  receiptNumber: receipt.receiptNumber,
                  invoiceId: invoice.id,
                  invoiceNumber: invoice.invoiceNumber,
                  amountPaid,
                  paymentMethod: 'RAZORPAY',
                  createdByUserId: paymentAttempt.initiatedByUserId,
                });

                this.presenceGateway.broadcastEvent(orgId, 'invoice:updated', {
                  id: invoice.id,
                  invoiceNumber: invoice.invoiceNumber,
                  paidAmount: newPaid,
                  outstandingAmount: newOutstanding,
                  paymentStatus: newPaymentStatus,
                });
              },
              { maxWait: 10_000, timeout: 30_000 },
            );
          }
        }
      } else if (eventType === 'payment.failed') {
        const paymentEntity = payload.payload?.payment?.entity;
        const orderId = paymentEntity?.order_id;

        if (orderId) {
          const attempt = await this.prisma.paymentAttempt.findFirst({
            where: { razorpayOrderId: orderId },
          });

          if (attempt && attempt.status !== 'CAPTURED') {
            await this.prisma.paymentAttempt.update({
              where: { id: attempt.id },
              data: {
                status: 'FAILED',
                failureCode: paymentEntity.error_code || 'PAYMENT_FAILED',
                failureReason: paymentEntity.error_description || 'Payment failed at gateway',
              },
            });
          }
        }
      } else if (eventType === 'refund.processed' || eventType === 'refund.created') {
        const refundEntity = payload.payload?.refund?.entity;
        const refundId = refundEntity?.id;

        if (refundId) {
          const refundRecord = await this.prisma.paymentRefund.findUnique({
            where: { razorpayRefundId: refundId },
          });

          if (refundRecord && refundRecord.status !== 'PROCESSED') {
            await this.prisma.paymentRefund.update({
              where: { id: refundRecord.id },
              data: {
                status: 'PROCESSED',
                processedAt: new Date(),
              },
            });
          }
        }
      }

      // Record successful webhook execution
      await this.prisma.webhookEvent.create({
        data: {
          eventId,
          eventType,
          entityId: payload.payload?.payment?.entity?.id || payload.payload?.refund?.entity?.id || null,
          processedStatus: 'PROCESSED',
          processedAt: new Date(),
          payloadSummary: JSON.stringify({
            event: eventType,
            paymentId: payload.payload?.payment?.entity?.id,
            orderId: payload.payload?.payment?.entity?.order_id,
          }),
        },
      });

      return { success: true, message: 'Webhook processed successfully' };
    } catch (err: any) {
      this.logger.error(`[Webhook] Error processing event ${eventId}: ${err.message}`, err.stack);
      try {
        await this.prisma.webhookEvent.create({
          data: {
            eventId,
            eventType,
            entityId: payload.payload?.payment?.entity?.id || null,
            processedStatus: 'FAILED',
            errorMessage: err.message,
            payloadSummary: JSON.stringify({
              event: eventType,
            }),
          },
        });
      } catch {}
      throw err;
    }
  }

  /**
   * Owner/Manager-only Refund initiation.
   */
  async initiateRefund(
    tenantContext: TenantContext,
    dto: CreatePaymentRefundDto,
    currentUserId?: string,
  ): Promise<PaymentRefundResponse> {
    if (!this.isOwnerOrManager(tenantContext)) {
      throw new ForbiddenException('Only Owners and Managers have permission to issue payment refunds.');
    }

    const orgId = tenantContext.organizationId;
    const userId = currentUserId || tenantContext.userId;
    if (!userId) {
      throw new BadRequestException('User ID is required.');
    }

    let paymentAttempt: any = null;
    if (dto.paymentAttemptId) {
      paymentAttempt = await this.prisma.paymentAttempt.findFirst({
        where: { id: dto.paymentAttemptId, organizationId: orgId },
        include: { refunds: true, invoice: true, payment: true },
      });
    } else if (dto.paymentId) {
      paymentAttempt = await this.prisma.paymentAttempt.findFirst({
        where: { payment: { id: dto.paymentId }, organizationId: orgId },
        include: { refunds: true, invoice: true, payment: true },
      });
    }

    if (!paymentAttempt) {
      throw new NotFoundException('Captured payment attempt not found for this organization.');
    }

    if (paymentAttempt.status !== 'CAPTURED' && paymentAttempt.status !== 'PARTIALLY_REFUNDED') {
      throw new BadRequestException(`Cannot refund payment attempt with status '${paymentAttempt.status}'.`);
    }

    if (!paymentAttempt.razorpayPaymentId) {
      throw new BadRequestException('Payment attempt is missing Razorpay Payment ID.');
    }

    const existingRefundsTotal = (paymentAttempt.refunds || [])
      .filter((r: any) => r.status === 'PROCESSED')
      .reduce((acc: number, r: any) => acc + r.amount, 0);

    const maxRefundable = Math.max(0, paymentAttempt.expectedAmount - existingRefundsTotal);
    if (maxRefundable <= 0) {
      throw new BadRequestException('This payment has already been completely refunded.');
    }

    const refundAmount =
      dto.amount !== undefined && dto.amount !== null ? Number(dto.amount) : maxRefundable;
    if (isNaN(refundAmount) || refundAmount <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero.');
    }

    if (refundAmount > maxRefundable) {
      throw new BadRequestException(
        `Requested refund amount (₹${refundAmount.toFixed(2)}) exceeds maximum refundable balance (₹${maxRefundable.toFixed(2)}).`,
      );
    }

    const amountInPaise = Math.round(refundAmount * 100);

    // Call Razorpay Refund API
    const rzpRefund = await this.razorpayService.createRefund(
      paymentAttempt.razorpayPaymentId,
      amountInPaise,
      {
        organizationId: orgId,
        invoiceId: paymentAttempt.invoiceId,
        reason: dto.reason || 'Owner refund',
      },
    );

    // Process local adjustments transactionally
    return this.prisma.$transaction(
      async (tx) => {
        const invoice = await tx.saleInvoice.findUnique({
          where: { id: paymentAttempt.invoiceId },
        });

        if (!invoice) {
          throw new NotFoundException('Invoice not found.');
        }

        const newPaidAmount = Math.max(0, invoice.paidAmount - refundAmount);
        const newOutstandingAmount = Math.min(
          invoice.totalAmount,
          invoice.outstandingAmount + refundAmount,
        );
        const newPaymentStatus = newPaidAmount === 0 ? 'UNPAID' : 'PARTIALLY_PAID';
        const isFullRefund = existingRefundsTotal + refundAmount >= paymentAttempt.expectedAmount;

        // 1. Create Payment Refund record
        const refundRecord = await tx.paymentRefund.create({
          data: {
            organizationId: orgId,
            paymentAttemptId: paymentAttempt.id,
            paymentId: paymentAttempt.payment?.id || null,
            invoiceId: invoice.id,
            razorpayRefundId: rzpRefund.id,
            razorpayPaymentId: paymentAttempt.razorpayPaymentId,
            amount: refundAmount,
            amountInPaise,
            currency: 'INR',
            reason: dto.reason || null,
            status: 'PROCESSED',
            requestedByUserId: userId,
            processedAt: new Date(),
          },
        });

        // 2. Update Payment Attempt status
        await tx.paymentAttempt.update({
          where: { id: paymentAttempt.id },
          data: {
            status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          },
        });

        // 3. Update Sale Invoice balances
        const updatedInvoice = await tx.saleInvoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: newPaidAmount,
            outstandingAmount: newOutstandingAmount,
            paymentStatus: newPaymentStatus,
          },
        });

        // 4. Update Customer balance if customer attached
        if (invoice.customerId) {
          await tx.customer.update({
            where: { id: invoice.customerId },
            data: {
              outstandingBalance: { increment: refundAmount },
            },
          });
        }

        // 5. Audit Log
        await tx.auditLog.create({
          data: {
            organizationId: orgId,
            outletId: invoice.outletId,
            userId,
            action: 'RAZORPAY_PAYMENT_REFUNDED',
            resource: 'PaymentRefund',
            resourceId: refundRecord.id,
            afterState: JSON.stringify({
              refundId: refundRecord.id,
              razorpayRefundId: rzpRefund.id,
              amount: refundAmount,
              invoiceNumber: invoice.invoiceNumber,
              newPaidAmount,
              newOutstandingAmount,
              newPaymentStatus,
            }),
          },
        });

        // 6. Broadcast Real-Time Update
        this.presenceGateway.broadcastEvent(orgId, 'invoice:updated', {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          paidAmount: newPaidAmount,
          outstandingAmount: newOutstandingAmount,
          paymentStatus: newPaymentStatus,
        });

        return {
          success: true,
          refundId: refundRecord.id,
          razorpayRefundId: rzpRefund.id,
          amount: refundAmount,
          invoiceId: updatedInvoice.id,
          invoiceNumber: updatedInvoice.invoiceNumber,
          newPaidAmount: updatedInvoice.paidAmount,
          newOutstandingAmount: updatedInvoice.outstandingAmount,
          paymentStatus: updatedInvoice.paymentStatus,
        };
      },
      { maxWait: 10_000, timeout: 30_000 },
    );
  }

  /**
   * Pending Payment Attempt reconciliation tool for owners.
   */
  async reconcilePaymentAttempt(
    tenantContext: TenantContext,
    paymentAttemptId: string,
    currentUserId?: string,
  ): Promise<ReconcilePaymentAttemptResponse> {
    if (!this.isOwnerOrManager(tenantContext)) {
      throw new ForbiddenException('Only Owners and Managers can reconcile payments.');
    }

    const orgId = tenantContext.organizationId;
    const userId = currentUserId || tenantContext.userId;

    const paymentAttempt = await this.prisma.paymentAttempt.findFirst({
      where: { id: paymentAttemptId, organizationId: orgId },
      include: { invoice: true },
    });

    if (!paymentAttempt) {
      throw new NotFoundException('Payment attempt not found.');
    }

    if (paymentAttempt.status === 'CAPTURED') {
      return {
        success: true,
        status: 'CAPTURED',
        message: 'Payment attempt is already captured and verified.',
        paymentAttemptId: paymentAttempt.id,
        invoiceId: paymentAttempt.invoice.id,
        invoiceNumber: paymentAttempt.invoice.invoiceNumber,
        paidAmount: paymentAttempt.invoice.paidAmount,
        outstandingAmount: paymentAttempt.invoice.outstandingAmount,
      };
    }

    // Check remote status via Razorpay fetchPayment if paymentId exists
    if (paymentAttempt.razorpayPaymentId) {
      try {
        const rzpPayment = await this.razorpayService.fetchPayment(
          paymentAttempt.razorpayPaymentId,
        );
        if (
          rzpPayment &&
          (rzpPayment.status === 'captured' || rzpPayment.status === 'authorized')
        ) {
          const verified = await this.verifyAndCapturePayment(
            tenantContext,
            {
              razorpayOrderId: paymentAttempt.razorpayOrderId,
              razorpayPaymentId: paymentAttempt.razorpayPaymentId,
              razorpaySignature: 'reconciled_by_owner',
            },
            userId,
          );

          return {
            success: true,
            status: 'CAPTURED',
            message: 'Payment reconciled and captured successfully from Razorpay.',
            paymentAttemptId: paymentAttempt.id,
            invoiceId: verified.invoiceId,
            invoiceNumber: verified.invoiceNumber,
            paidAmount: verified.paidAmount,
            outstandingAmount: verified.outstandingAmount,
          };
        }
      } catch (err: any) {
        this.logger.warn(
          `Remote reconciliation check failed for ${paymentAttempt.razorpayPaymentId}: ${err.message}`,
        );
      }
    }

    return {
      success: true,
      status: paymentAttempt.status,
      message: `Payment attempt is currently ${paymentAttempt.status}.`,
      paymentAttemptId: paymentAttempt.id,
      invoiceId: paymentAttempt.invoice.id,
      invoiceNumber: paymentAttempt.invoice.invoiceNumber,
      paidAmount: paymentAttempt.invoice.paidAmount,
      outstandingAmount: paymentAttempt.invoice.outstandingAmount,
    };
  }

  /**
   * Get refunds for an invoice or organization.
   */
  async getRefunds(tenantContext: TenantContext, invoiceId?: string) {
    return this.prisma.paymentRefund.findMany({
      where: {
        organizationId: tenantContext.organizationId,
        ...(invoiceId ? { invoiceId } : {}),
      },
      include: {
        requestedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}


