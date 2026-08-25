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

export async function generateDocumentNumber(
  tx: any,
  organizationId: string,
  type: 'QUOTATION' | 'INVOICE' | 'RECEIPT',
): Promise<string> {
  const year = new Date().getFullYear();
  const counter = await tx.documentCounter.upsert({
    where: {
      organizationId_type_year: {
        organizationId,
        type,
        year,
      },
    },
    create: {
      organizationId,
      type,
      year,
      currentCount: 1,
    },
    update: {
      currentCount: { increment: 1 },
    },
  });

  const prefix = type === 'QUOTATION' ? 'QTN' : type === 'INVOICE' ? 'INV' : 'RCP';
  return `${prefix}-${year}-${String(counter.currentCount).padStart(4, '0')}`;
}

@Injectable()
export class QuotationsService {
  private readonly logger = new Logger(QuotationsService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => PresenceGateway))
    private presenceGateway: PresenceGateway,
  ) {}

  private isOwnerOrManager(tenantContext: TenantContext): boolean {
    const roles = tenantContext.roles || [];
    return (
      roles.includes('OWNER') ||
      roles.includes('MANAGER') ||
      roles.includes('SUPER_ADMIN') ||
      roles.includes('SUPER_ADMIN_SUPPORT')
    );
  }

  async getQuotations(
    tenantContext: TenantContext,
    query?: {
      search?: string;
      status?: string;
      customerId?: string;
      cashierId?: string;
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

    // Cashier Scope: Cashiers can only view their own quotations
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

    if (query?.customerId && query.customerId !== 'ALL') {
      where.customerId = query.customerId;
    }

    if (query?.search) {
      where.OR = [
        { quotationNumber: { contains: query.search, mode: 'insensitive' } },
        { customer: { name: { contains: query.search, mode: 'insensitive' } } },
        { customer: { phone: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    if (query?.startDate || query?.endDate) {
      where.quotationDate = {};
      if (query.startDate) where.quotationDate.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.quotationDate.lte = end;
      }
    }

    return this.prisma.quotation.findMany({
      where,
      include: {
        customer: true,
        outlet: { select: { id: true, name: true, code: true } },
        createdByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        items: true,
        convertedInvoice: { select: { id: true, invoiceNumber: true, paymentStatus: true, totalAmount: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getQuotationDetail(tenantContext: TenantContext, id: string, currentUserId?: string) {
    const orgId = tenantContext.organizationId;
    const isOwner = this.isOwnerOrManager(tenantContext);
    const userId = currentUserId || tenantContext.userId;

    const quotation = await this.prisma.quotation.findFirst({
      where: {
        id,
        organizationId: orgId,
        ...(!isOwner ? { createdByUserId: userId } : {}),
      },
      include: {
        customer: true,
        outlet: true,
        organization: true,
        createdByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        items: {
          include: { product: true },
        },
        convertedInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            paymentStatus: true,
            totalAmount: true,
            paidAmount: true,
            outstandingAmount: true,
            createdAt: true,
          },
        },
      },
    });

    if (!quotation) {
      throw new NotFoundException('Quotation not found or access denied.');
    }

    return quotation;
  }

  async createQuotation(
    tenantContext: TenantContext,
    dto: {
      outletId?: string;
      customerId?: string;
      quotationDate?: string;
      validUntil?: string;
      discountPercent?: number;
      additionalCharges?: number;
      termsAndConditions?: string;
      notes?: string;
      items: {
        productId?: string;
        description: string;
        quantity: number;
        unitPrice: number;
        unitCost?: number;
        discountAmount?: number;
        taxRate?: number;
      }[];
    },
    currentUserId?: string,
  ) {
    const orgId = tenantContext.organizationId;
    const outletId = dto.outletId || tenantContext.outletId;
    const userId = currentUserId || tenantContext.userId;

    if (!outletId) {
      throw new BadRequestException('Branch / Outlet context is required.');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Line items are required for quotation.');
    }

    // Load products for snapshot and permission check
    const productIds = dto.items.map((it) => it.productId).filter(Boolean) as string[];
    const dbProducts = productIds.length > 0
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds }, organizationId: orgId },
        })
      : [];
    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    const discountPercent = Number(dto.discountPercent || 0);
    const additionalCharges = Number(dto.additionalCharges || 0);

    let subtotal = 0;
    let totalDiscount = 0;
    let taxableAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;

    const processedItems = dto.items.map((item) => {
      const qty = Number(item.quantity || 1);
      const unitPrice = Number(item.unitPrice || 0);
      const lineSubtotal = qty * unitPrice;
      const lineDiscount =
        item.discountAmount !== undefined
          ? Number(item.discountAmount)
          : (lineSubtotal * discountPercent) / 100;
      const lineTaxable = Math.max(0, lineSubtotal - lineDiscount);
      const taxRate = Number(item.taxRate ?? 5.0);
      const lineTax = (lineTaxable * taxRate) / 100;
      const lineCgst = lineTax / 2;
      const lineSgst = lineTax / 2;
      const lineTotal = lineTaxable + lineTax;

      subtotal += lineSubtotal;
      totalDiscount += lineDiscount;
      taxableAmount += lineTaxable;
      cgstAmount += lineCgst;
      sgstAmount += lineSgst;

      const dbProduct = item.productId ? productMap.get(item.productId) : null;
      const unitCost = Number(
        item.unitCost !== undefined && item.unitCost !== null
          ? item.unitCost
          : dbProduct?.costPrice || 0,
      );

      return {
        productId: item.productId || null,
        description: item.description || dbProduct?.name || 'Item',
        productName: dbProduct?.name || item.description || 'Item',
        sku: dbProduct?.sku || null,
        quantity: qty,
        unitPrice,
        unitCost,
        discountAmount: lineDiscount,
        taxRate,
        taxableAmount: lineTaxable,
        cgst: lineCgst,
        sgst: lineSgst,
        igst: 0,
        totalAmount: lineTotal,
      };
    });

    const totalAmount = taxableAmount + cgstAmount + sgstAmount + additionalCharges;

    return this.prisma.$transaction(async (tx) => {
      const quotationNumber = await generateDocumentNumber(tx, orgId, 'QUOTATION');

      const quotation = await tx.quotation.create({
        data: {
          quotationNumber,
          organizationId: orgId,
          outletId,
          customerId: dto.customerId || null,
          quotationDate: dto.quotationDate ? new Date(dto.quotationDate) : new Date(),
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          subtotal,
          discountPercent,
          discountAmount: totalDiscount,
          taxableAmount,
          cgstAmount,
          sgstAmount,
          igstAmount: 0,
          additionalCharges,
          totalAmount,
          status: 'DRAFT',
          termsAndConditions: dto.termsAndConditions || null,
          notes: dto.notes || null,
          createdByUserId: userId || null,
          items: {
            create: processedItems,
          },
        },
        include: {
          customer: true,
          outlet: true,
          items: true,
          createdByUser: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          outletId,
          userId: userId || null,
          action: 'QUOTATION_CREATED',
          resource: 'Quotation',
          resourceId: quotation.id,
          afterState: JSON.stringify({
            quotationNumber,
            totalAmount,
            status: quotation.status,
          }),
        },
      });

      this.presenceGateway.broadcastEvent(orgId, 'quotation:created', {
        id: quotation.id,
        quotationNumber: quotation.quotationNumber,
        customerId: quotation.customerId,
        customerName: quotation.customer?.name || 'Customer',
        totalAmount: quotation.totalAmount,
        createdByUserId: userId,
      });

      return quotation;
    }, {
      maxWait: 10_000,
      timeout: 30_000,
    });
  }

  async updateQuotation(
    tenantContext: TenantContext,
    id: string,
    dto: {
      customerId?: string;
      validUntil?: string;
      discountPercent?: number;
      additionalCharges?: number;
      termsAndConditions?: string;
      notes?: string;
      items?: {
        productId?: string;
        description: string;
        quantity: number;
        unitPrice: number;
        unitCost?: number;
        discountAmount?: number;
        taxRate?: number;
      }[];
    },
    currentUserId?: string,
  ) {
    const orgId = tenantContext.organizationId;
    const isOwner = this.isOwnerOrManager(tenantContext);
    const userId = currentUserId || tenantContext.userId;

    const existing = await this.prisma.quotation.findFirst({
      where: {
        id,
        organizationId: orgId,
        ...(!isOwner ? { createdByUserId: userId } : {}),
      },
      include: { items: true },
    });

    if (!existing) {
      throw new NotFoundException('Quotation not found or access denied.');
    }

    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot edit quotation in '${existing.status}' status. Only DRAFT quotations can be edited.`);
    }

    return this.prisma.$transaction(async (tx) => {
      let subtotal = existing.subtotal;
      let totalDiscount = existing.discountAmount;
      let taxableAmount = existing.taxableAmount;
      let cgstAmount = existing.cgstAmount;
      let sgstAmount = existing.sgstAmount;
      const additionalCharges = dto.additionalCharges !== undefined ? Number(dto.additionalCharges) : existing.additionalCharges;

      if (dto.items && dto.items.length > 0) {
        await tx.quotationItem.deleteMany({ where: { quotationId: id } });

        const productIds = dto.items.map((it) => it.productId).filter(Boolean) as string[];
        const dbProducts = productIds.length > 0
          ? await tx.product.findMany({ where: { id: { in: productIds }, organizationId: orgId } })
          : [];
        const productMap = new Map(dbProducts.map((p) => [p.id, p]));

        const discountPercent = Number(dto.discountPercent ?? existing.discountPercent ?? 0);
        subtotal = 0;
        totalDiscount = 0;
        taxableAmount = 0;
        cgstAmount = 0;
        sgstAmount = 0;

        const processedItems = dto.items.map((item) => {
          const qty = Number(item.quantity || 1);
          const unitPrice = Number(item.unitPrice || 0);
          const lineSubtotal = qty * unitPrice;
          const lineDiscount =
            item.discountAmount !== undefined
              ? Number(item.discountAmount)
              : (lineSubtotal * discountPercent) / 100;
          const lineTaxable = Math.max(0, lineSubtotal - lineDiscount);
          const taxRate = Number(item.taxRate ?? 5.0);
          const lineTax = (lineTaxable * taxRate) / 100;
          const lineCgst = lineTax / 2;
          const lineSgst = lineTax / 2;
          const lineTotal = lineTaxable + lineTax;

          subtotal += lineSubtotal;
          totalDiscount += lineDiscount;
          taxableAmount += lineTaxable;
          cgstAmount += lineCgst;
          sgstAmount += lineSgst;

          const dbProduct = item.productId ? productMap.get(item.productId) : null;
          const unitCost = Number(
            item.unitCost !== undefined && item.unitCost !== null
              ? item.unitCost
              : dbProduct?.costPrice || 0,
          );

          return {
            quotationId: id,
            productId: item.productId || null,
            description: item.description || dbProduct?.name || 'Item',
            productName: dbProduct?.name || item.description || 'Item',
            sku: dbProduct?.sku || null,
            quantity: qty,
            unitPrice,
            unitCost,
            discountAmount: lineDiscount,
            taxRate,
            taxableAmount: lineTaxable,
            cgst: lineCgst,
            sgst: lineSgst,
            igst: 0,
            totalAmount: lineTotal,
          };
        });

        await tx.quotationItem.createMany({ data: processedItems });
      }

      const totalAmount = taxableAmount + cgstAmount + sgstAmount + additionalCharges;

      const updated = await tx.quotation.update({
        where: { id },
        data: {
          customerId: dto.customerId !== undefined ? dto.customerId : existing.customerId,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : existing.validUntil,
          subtotal,
          discountAmount: totalDiscount,
          discountPercent: dto.discountPercent !== undefined ? dto.discountPercent : existing.discountPercent,
          taxableAmount,
          cgstAmount,
          sgstAmount,
          additionalCharges,
          totalAmount,
          termsAndConditions: dto.termsAndConditions !== undefined ? dto.termsAndConditions : existing.termsAndConditions,
          notes: dto.notes !== undefined ? dto.notes : existing.notes,
        },
        include: {
          customer: true,
          outlet: true,
          items: true,
          createdByUser: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      this.presenceGateway.broadcastEvent(orgId, 'quotation:updated', {
        id: updated.id,
        quotationNumber: updated.quotationNumber,
        status: updated.status,
        totalAmount: updated.totalAmount,
      });

      return updated;
    }, {
      maxWait: 10_000,
      timeout: 30_000,
    });
  }

  async updateQuotationStatus(
    tenantContext: TenantContext,
    id: string,
    status: string,
    reason?: string,
    currentUserId?: string,
  ) {
    const orgId = tenantContext.organizationId;
    const isOwner = this.isOwnerOrManager(tenantContext);
    const userId = currentUserId || tenantContext.userId;

    const allowedTransitions: Record<string, string[]> = {
      DRAFT: ['SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED'],
      SENT: ['ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED'],
      ACCEPTED: ['REJECTED', 'CANCELLED'], // Conversion handled separately
      REJECTED: ['DRAFT', 'CANCELLED'],
      EXPIRED: ['DRAFT', 'CANCELLED'],
      CONVERTED: [], // Cannot change converted quotation status
      CANCELLED: [],
    };

    const quotation = await this.prisma.quotation.findFirst({
      where: {
        id,
        organizationId: orgId,
        ...(!isOwner ? { createdByUserId: userId } : {}),
      },
    });

    if (!quotation) {
      throw new NotFoundException('Quotation not found or access denied.');
    }

    if (quotation.status === 'CONVERTED') {
      throw new BadRequestException('Quotation has already been converted to an invoice and its status cannot be modified.');
    }

    const validNext = allowedTransitions[quotation.status] || [];
    if (!validNext.includes(status)) {
      throw new BadRequestException(`Cannot change quotation status from '${quotation.status}' to '${status}'.`);
    }

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: {
        status,
        ...(reason ? { cancelReason: reason } : {}),
      },
      include: {
        customer: true,
        outlet: true,
        items: true,
      },
    });

    this.presenceGateway.broadcastEvent(orgId, 'quotation:updated', {
      id: updated.id,
      quotationNumber: updated.quotationNumber,
      status: updated.status,
      cancelReason: updated.cancelReason,
    });

    return updated;
  }

  async convertToInvoice(
    tenantContext: TenantContext,
    quotationId: string,
    dto: {
      paymentMethod?: 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT';
      paidAmount?: number;
      notes?: string;
    },
    currentUserId?: string,
  ) {
    const orgId = tenantContext.organizationId;
    const userId = currentUserId || tenantContext.userId;
    const isOwner = this.isOwnerOrManager(tenantContext);

    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch & lock quotation
      const quotation = await tx.quotation.findFirst({
        where: {
          id: quotationId,
          organizationId: orgId,
          ...(!isOwner ? { createdByUserId: userId } : {}),
        },
        include: {
          items: true,
          customer: true,
        },
      });

      if (!quotation) {
        throw new NotFoundException('Quotation not found or access denied.');
      }

      if (quotation.status === 'CONVERTED' || quotation.convertedInvoiceId) {
        throw new BadRequestException('Quotation has already been converted to an invoice.');
      }

      if (quotation.status !== 'ACCEPTED' && quotation.status !== 'SENT' && quotation.status !== 'DRAFT') {
        throw new BadRequestException(`Quotation status is '${quotation.status}'. Only Active / Accepted quotations can be converted.`);
      }

      // 2. Validate product stock before creating invoice
      for (const item of quotation.items) {
        if (item.productId) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });
          if (!product) {
            throw new BadRequestException(`Product '${item.description}' no longer exists.`);
          }
        }
      }

      // 3. Generate atomic invoice number
      const invoiceNumber = await generateDocumentNumber(tx, orgId, 'INVOICE');

      // 4. Calculate amounts
      const paymentMethod = dto.paymentMethod || 'CREDIT';
      const isCredit = paymentMethod === 'CREDIT';
      const paidAmount = isCredit ? Number(dto.paidAmount || 0) : quotation.totalAmount;
      const outstandingAmount = Math.max(0, quotation.totalAmount - paidAmount);
      const paymentStatus =
        outstandingAmount === 0 ? 'PAID' : paidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

      const activeSession = await tx.registerSession.findFirst({
        where: {
          organizationId: orgId,
          outletId: quotation.outletId,
          openedByUserId: userId,
          status: 'OPEN',
        },
        orderBy: { openedAt: 'desc' },
      });

      // 5. Create SaleInvoice
      const invoice = await tx.saleInvoice.create({
        data: {
          invoiceNumber,
          organizationId: orgId,
          outletId: quotation.outletId,
          customerId: quotation.customerId,
          quotationId: quotation.id,
          registerSessionId: activeSession?.id || null,
          subtotal: quotation.subtotal,
          discountAmount: quotation.discountAmount,
          taxableAmount: quotation.taxableAmount,
          cgstAmount: quotation.cgstAmount,
          sgstAmount: quotation.sgstAmount,
          igstAmount: quotation.igstAmount,
          additionalCharges: quotation.additionalCharges,
          totalAmount: quotation.totalAmount,
          paidAmount,
          outstandingAmount,
          paymentStatus,
          isPosSale: false,
          createdByUserId: userId || null,
          termsAndConditions: quotation.termsAndConditions,
          notes: dto.notes || quotation.notes,
          items: {
            create: quotation.items.map((it) => ({
              productId: it.productId,
              description: it.description,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              unitCost: it.unitCost,
              discountAmount: it.discountAmount,
              taxRate: it.taxRate,
              taxableAmount: it.taxableAmount,
              cgst: it.cgst,
              sgst: it.sgst,
              igst: it.igst,
              totalAmount: it.totalAmount,
            })),
          },
        },
      });

      // 6. Reduce product stock exactly once
      for (const item of quotation.items) {
        if (item.productId) {
          await tx.product.updateMany({
            where: { id: item.productId, organizationId: orgId },
            data: {
              stockQty: { decrement: item.quantity },
            },
          });
        }
      }

      // 7. If payment provided, create Payment & generate Receipt
      if (paidAmount > 0) {
        const paymentNumber = await generateDocumentNumber(tx, orgId, 'RECEIPT');
        const payment = await tx.payment.create({
          data: {
            paymentNumber,
            organizationId: orgId,
            outletId: quotation.outletId,
            type: 'CUSTOMER_RECEIPT',
            customerId: quotation.customerId,
            invoiceId: invoice.id,
            registerSessionId: activeSession?.id || null,
            amount: paidAmount,
            paymentMethod,
            status: 'COMPLETED',
            createdByUserId: userId || null,
            notes: dto.notes || `Initial payment for ${invoiceNumber}`,
          },
        });

        // Create Receipt record
        await tx.receipt.create({
          data: {
            receiptNumber: paymentNumber,
            organizationId: orgId,
            outletId: quotation.outletId,
            invoiceId: invoice.id,
            paymentId: payment.id,
            customerId: quotation.customerId,
            amountPaid: paidAmount,
            previouslyPaid: 0,
            totalPaid: paidAmount,
            remainingBalance: outstandingAmount,
            paymentMethod,
            paymentDate: new Date(),
            status: 'ISSUED',
            notes: dto.notes || `Converted from Quotation ${quotation.quotationNumber}`,
            createdByUserId: userId || null,
          },
        });

        if (paymentMethod === 'CASH' && activeSession) {
          await tx.registerSession.update({
            where: { id: activeSession.id },
            data: { cashSales: { increment: paidAmount } },
          });
        }
      }

      // Update customer balance if credit/outstanding remains
      if (quotation.customerId && outstandingAmount > 0) {
        await tx.customer.update({
          where: { id: quotation.customerId },
          data: { outstandingBalance: { increment: outstandingAmount } },
        });
      }

      // 8. Mark quotation as CONVERTED
      await tx.quotation.update({
        where: { id: quotationId },
        data: {
          status: 'CONVERTED',
          convertedInvoiceId: invoice.id,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          outletId: quotation.outletId,
          userId: userId || null,
          action: 'QUOTATION_CONVERTED_TO_INVOICE',
          resource: 'Quotation',
          resourceId: quotation.id,
          afterState: JSON.stringify({
            quotationNumber: quotation.quotationNumber,
            invoiceNumber: invoice.invoiceNumber,
            totalAmount: quotation.totalAmount,
            paidAmount,
          }),
        },
      });

      this.presenceGateway.broadcastEvent(orgId, 'quotation:converted', {
        quotationId: quotation.id,
        quotationNumber: quotation.quotationNumber,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: quotation.totalAmount,
        createdByUserId: userId,
      });

      return invoice;
    }, {
      maxWait: 10_000,
      timeout: 30_000,
    });
  }

  async duplicateQuotation(tenantContext: TenantContext, id: string, currentUserId?: string) {
    const orgId = tenantContext.organizationId;
    const isOwner = this.isOwnerOrManager(tenantContext);
    const userId = currentUserId || tenantContext.userId;

    const source = await this.prisma.quotation.findFirst({
      where: {
        id,
        organizationId: orgId,
        ...(!isOwner ? { createdByUserId: userId } : {}),
      },
      include: { items: true },
    });

    if (!source) {
      throw new NotFoundException('Source quotation not found.');
    }

    return this.createQuotation(
      tenantContext,
      {
        outletId: source.outletId,
        customerId: source.customerId || undefined,
        discountPercent: source.discountPercent,
        additionalCharges: source.additionalCharges,
        termsAndConditions: source.termsAndConditions || undefined,
        notes: source.notes ? `Duplicated from ${source.quotationNumber}: ${source.notes}` : undefined,
        items: source.items.map((it) => ({
          productId: it.productId || undefined,
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          unitCost: it.unitCost,
          discountAmount: it.discountAmount,
          taxRate: it.taxRate,
        })),
      },
      userId,
    );
  }
}
