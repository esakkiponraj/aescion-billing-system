import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TenantContext } from '@aescion/types';
import { PresenceGateway } from '../presence/presence.gateway';

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => PresenceGateway))
    private presenceGateway: PresenceGateway,
  ) {}

  private isOwner(tenantContext: TenantContext): boolean {
    const roles = tenantContext.roles || [];
    return (
      roles.includes('OWNER') ||
      roles.includes('SUPER_ADMIN') ||
      roles.includes('SUPER_ADMIN_SUPPORT')
    );
  }

  private isOwnerOrManager(tenantContext: TenantContext): boolean {
    const roles = tenantContext.roles || [];
    return (
      roles.includes('OWNER') ||
      roles.includes('MANAGER') ||
      roles.includes('SUPER_ADMIN') ||
      roles.includes('SUPER_ADMIN_SUPPORT')
    );
  }

  async getReceipts(
    tenantContext: TenantContext,
    query?: {
      search?: string;
      status?: string;
      customerId?: string;
      invoiceId?: string;
      cashierId?: string;
      paymentMethod?: string;
      outletId?: string;
      startDate?: string;
      endDate?: string;
    },
    currentUserId?: string,
  ) {
    const orgId = tenantContext.organizationId;
    const userId = currentUserId || tenantContext.userId;
    const isOwner = this.isOwnerOrManager(tenantContext);

    const where: any = { organizationId: orgId };

    // Cashier Scope: Cashiers can only view their own receipts
    if (!isOwner) {
      where.createdByUserId = userId;
    } else if (query?.cashierId && query.cashierId !== 'ALL') {
      where.createdByUserId = query.cashierId;
    }

    if (query?.outletId && query.outletId !== 'ALL') {
      where.outletId = query.outletId;
    } else if (tenantContext.outletId && !isOwner) {
      where.outletId = tenantContext.outletId;
    }

    if (query?.status && query.status !== 'ALL') {
      where.status = query.status;
    }

    if (query?.paymentMethod && query.paymentMethod !== 'ALL') {
      where.paymentMethod = query.paymentMethod;
    }

    if (query?.customerId && query.customerId !== 'ALL') {
      where.customerId = query.customerId;
    }

    if (query?.invoiceId && query.invoiceId !== 'ALL') {
      where.invoiceId = query.invoiceId;
    }

    if (query?.search) {
      where.OR = [
        { receiptNumber: { contains: query.search, mode: 'insensitive' } },
        { invoice: { invoiceNumber: { contains: query.search, mode: 'insensitive' } } },
        { customer: { name: { contains: query.search, mode: 'insensitive' } } },
        { referenceNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query?.startDate || query?.endDate) {
      where.paymentDate = {};
      if (query.startDate) where.paymentDate.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.paymentDate.lte = end;
      }
    }

    return this.prisma.receipt.findMany({
      where,
      include: {
        customer: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            paidAmount: true,
            outstandingAmount: true,
            paymentStatus: true,
          },
        },
        outlet: { select: { id: true, name: true, code: true } },
        createdByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        voidedByUser: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { paymentDate: 'desc' },
    });
  }

  async getReceiptDetail(tenantContext: TenantContext, id: string, currentUserId?: string) {
    const orgId = tenantContext.organizationId;
    const isOwner = this.isOwnerOrManager(tenantContext);
    const userId = currentUserId || tenantContext.userId;

    const receipt = await this.prisma.receipt.findFirst({
      where: {
        id,
        organizationId: orgId,
        ...(!isOwner ? { createdByUserId: userId } : {}),
      },
      include: {
        customer: true,
        outlet: true,
        organization: true,
        invoice: {
          include: {
            items: true,
            customer: true,
          },
        },
        payment: true,
        createdByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        voidedByUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!receipt) {
      throw new NotFoundException('Receipt not found or access denied.');
    }

    return receipt;
  }

  async voidReceipt(
    tenantContext: TenantContext,
    receiptId: string,
    reason: string,
    currentUserId?: string,
  ) {
    const orgId = tenantContext.organizationId;
    const userId = currentUserId || tenantContext.userId;

    // Only Owner (or Super Admin) can void receipts
    if (!this.isOwner(tenantContext)) {
      throw new ForbiddenException('Access Denied: Only the Business Owner is authorized to void receipts.');
    }

    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('A reason is required to void a receipt.');
    }

    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.findFirst({
        where: { id: receiptId, organizationId: orgId },
        include: { invoice: true, payment: true },
      });

      if (!receipt) {
        throw new NotFoundException('Receipt not found.');
      }

      if (receipt.status === 'VOIDED') {
        throw new BadRequestException('Receipt has already been voided.');
      }

      const amountToReverse = receipt.amountPaid;
      const invoice = receipt.invoice;

      // 1. Mark receipt as VOIDED
      const updatedReceipt = await tx.receipt.update({
        where: { id: receiptId },
        data: {
          status: 'VOIDED',
          voidReason: reason,
          voidedAt: new Date(),
          voidedByUserId: userId || null,
        },
        include: {
          customer: true,
          outlet: true,
          invoice: true,
          voidedByUser: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // 2. Re-calculate Invoice Balance
      if (invoice) {
        const newPaid = Math.max(0, invoice.paidAmount - amountToReverse);
        const newOutstanding = Math.max(0, invoice.totalAmount - newPaid);
        const newPaymentStatus =
          newOutstanding === 0 ? 'PAID' : newPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

        await tx.saleInvoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: newPaid,
            outstandingAmount: newOutstanding,
            paymentStatus: newPaymentStatus,
          },
        });

        // 3. Update Customer Outstanding Balance if customer exists
        if (invoice.customerId) {
          await tx.customer.update({
            where: { id: invoice.customerId },
            data: {
              outstandingBalance: { increment: amountToReverse },
            },
          });
        }
      }

      // 4. Mark linked Payment as VOIDED if exists
      if (receipt.paymentId) {
        await tx.payment.update({
          where: { id: receipt.paymentId },
          data: {
            status: 'VOIDED',
            notes: `VOIDED: ${reason}`,
          },
        });
      }

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          outletId: receipt.outletId,
          userId: userId || null,
          action: 'RECEIPT_VOIDED',
          resource: 'Receipt',
          resourceId: receipt.id,
          afterState: JSON.stringify({
            receiptNumber: receipt.receiptNumber,
            invoiceNumber: invoice?.invoiceNumber,
            reversedAmount: amountToReverse,
            voidReason: reason,
          }),
        },
      });

      this.presenceGateway.broadcastEvent(orgId, 'receipt:voided', {
        id: updatedReceipt.id,
        receiptNumber: updatedReceipt.receiptNumber,
        invoiceId: invoice?.id,
        invoiceNumber: invoice?.invoiceNumber,
        reversedAmount: amountToReverse,
        voidReason: reason,
      });

      return updatedReceipt;
    }, {
      maxWait: 10_000,
      timeout: 30_000,
    });
  }
}
