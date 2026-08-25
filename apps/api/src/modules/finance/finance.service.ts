import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TenantContext } from '@aescion/types';
import { PresenceService } from '../presence/presence.service';
import { PresenceGateway } from '../presence/presence.gateway';
import { generateDocumentNumber } from './quotations.service';

@Injectable()
export class FinanceService {
  constructor(
    private prisma: PrismaService,
    private presenceService: PresenceService,
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

  // Helper to get outlet filter based on tenant context
  private getOutletFilter(tenantContext?: TenantContext, requestedOutletId?: string) {
    if (requestedOutletId && requestedOutletId !== 'ALL') {
      return requestedOutletId;
    }
    if (!tenantContext) return undefined;
    const hasOrgWideScope =
      tenantContext.roles?.includes('OWNER') ||
      tenantContext.roles?.includes('SUPER_ADMIN_SUPPORT') ||
      tenantContext.permissions?.some(
        (p) => p.scope === 'ORGANIZATION' || p.scope === 'MULTI_OUTLET',
      );
    if (!hasOrgWideScope) {
      return tenantContext.outletId;
    }
    return undefined;
  }

  // ---------------------------------------------------------
  // 1. Finance Dashboard KPIs & Aggregates (Fully Live & Functional)
  // ---------------------------------------------------------
  async getDashboardSummary(tenantContext: TenantContext, query?: {
    outletId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const orgId = tenantContext.organizationId;
    const outletId = this.getOutletFilter(tenantContext, query?.outletId);

    // 1. Calculate Today's Date Boundaries (Local Day)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // 2. Fetch Today's Invoices for Live Today KPIs
    const todayInvoices = await this.prisma.saleInvoice.findMany({
      where: {
        organizationId: orgId,
        ...(outletId ? { outletId } : {}),
        createdAt: { gte: startOfToday, lte: endOfToday },
        paymentStatus: { not: 'CANCELLED' },
      },
      include: { items: true },
    });

    // Today Revenue: completed / paid sales for today (excluding unpaid/cancelled)
    const todaySales = todayInvoices.reduce((acc, inv) => {
      if (inv.paymentStatus === 'PAID') return acc + inv.totalAmount;
      if (inv.paymentStatus === 'PARTIALLY_PAID') return acc + (inv.paidAmount || 0);
      return acc;
    }, 0);

    const todaySalesCount = todayInvoices.length;

    // Today COGS and Gross Profit
    const todayCogs = todayInvoices.reduce((acc, inv) => {
      const lineCogs = inv.items.reduce((iAcc, item) => iAcc + (item.quantity * (item.unitCost || 0)), 0);
      return acc + lineCogs;
    }, 0);

    const todayGrossProfit = Math.max(0, todaySales - todayCogs);
    const todayGrossMargin = todaySales > 0 ? Number(((todayGrossProfit / todaySales) * 100).toFixed(1)) : 0.0;

    // 3. Filtered Date Range Invoices
    const dateFilter: any = {};
    if (query?.startDate || query?.endDate) {
      dateFilter.createdAt = {};
      if (query?.startDate) dateFilter.createdAt.gte = new Date(query.startDate);
      if (query?.endDate) dateFilter.createdAt.lte = new Date(query.endDate);
    }

    const whereSales: any = { organizationId: orgId, paymentStatus: { not: 'CANCELLED' } };
    if (outletId) whereSales.outletId = outletId;
    if (dateFilter.createdAt) whereSales.createdAt = dateFilter.createdAt;

    const wherePurchases: any = { organizationId: orgId, paymentStatus: { not: 'CANCELLED' } };
    if (outletId) wherePurchases.outletId = outletId;
    if (dateFilter.createdAt) wherePurchases.purchaseDate = dateFilter.createdAt;

    const whereExpenses: any = { organizationId: orgId, status: 'PAID' };
    if (outletId) whereExpenses.outletId = outletId;
    if (dateFilter.createdAt) whereExpenses.expenseDate = dateFilter.createdAt;

    const [
      salesInvoices,
      allOutlets,
      lowStockProducts,
      recentInvoices,
      allOrgInvoices,
      activeSessions,
      purchaseBills,
      expenses,
    ] = await Promise.all([
      this.prisma.saleInvoice.findMany({
        where: whereSales,
        include: { items: true, customer: true, outlet: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.outlet.findMany({
        where: { organizationId: orgId, isActive: true },
      }),
      this.prisma.product.findMany({
        where: { organizationId: orgId, stockQty: { lte: 15 } },
        orderBy: { stockQty: 'asc' },
        take: 10,
      }),
      this.prisma.saleInvoice.findMany({
        where: { organizationId: orgId, ...(outletId ? { outletId } : {}), paymentStatus: { not: 'CANCELLED' } },
        include: { customer: true, outlet: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.saleInvoice.findMany({
        where: { organizationId: orgId, ...(outletId ? { outletId } : {}), paymentStatus: { not: 'CANCELLED' } },
        select: { id: true, outstandingAmount: true, paymentStatus: true, totalAmount: true, paidAmount: true, dueDate: true },
      }),
      this.prisma.registerSession.findMany({
        where: { organizationId: orgId, ...(outletId ? { outletId } : {}), status: 'OPEN' },
      }),
      this.prisma.purchaseBill.findMany({
        where: wherePurchases,
        include: { items: true, supplier: true },
      }),
      this.prisma.expense.findMany({
        where: whereExpenses,
      }),
    ]);

    // 4. Calculations for Selected Period
    const totalSales = salesInvoices.reduce((acc, inv) => acc + inv.totalAmount, 0);
    const totalPurchases = purchaseBills.reduce((acc, b) => acc + b.totalAmount, 0);
    const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);

    const cogs = salesInvoices.reduce((acc, inv) => {
      const invCogs = inv.items.reduce((iAcc, item) => iAcc + (item.quantity * (item.unitCost || 0)), 0);
      return acc + invCogs;
    }, 0);

    const grossProfit = Math.max(0, totalSales - cogs);
    const grossMargin = totalSales > 0 ? Number(((grossProfit / totalSales) * 100).toFixed(1)) : 0.0;
    const netProfit = grossProfit - totalExpenses;

    // GST Breakdown
    const cgstOutput = salesInvoices.reduce((acc, inv) => acc + inv.cgstAmount, 0);
    const sgstOutput = salesInvoices.reduce((acc, inv) => acc + inv.sgstAmount, 0);
    const igstOutput = salesInvoices.reduce((acc, inv) => acc + inv.igstAmount, 0);
    const outputGst = cgstOutput + sgstOutput + igstOutput;

    const cgstInput = purchaseBills.reduce((acc, b) => acc + b.cgstAmount, 0);
    const sgstInput = purchaseBills.reduce((acc, b) => acc + b.sgstAmount, 0);
    const igstInput = purchaseBills.reduce((acc, b) => acc + b.igstAmount, 0);
    const inputGst = cgstInput + sgstInput + igstInput;

    const netGstPayable = outputGst - inputGst;

    // Receivables & Payables across organization
    const customerReceivables = allOrgInvoices
      .filter((inv) => inv.outstandingAmount > 0)
      .reduce((acc, inv) => acc + (inv.outstandingAmount || Math.max(0, inv.totalAmount - inv.paidAmount)), 0);

    const supplierPayables = purchaseBills
      .filter((b) => b.outstandingAmount > 0)
      .reduce((acc, b) => acc + b.outstandingAmount, 0);

    // Active Dining Tables
    const activeDiningTables = activeSessions.length;

    // Invoice Status Breakdown
    const now = new Date();
    let paidInvoices = 0;
    let partiallyPaidInvoices = 0;
    let unpaidInvoices = 0;
    let overdueInvoices = 0;

    for (const inv of allOrgInvoices) {
      if (inv.paymentStatus === 'PAID') paidInvoices++;
      else if (inv.paymentStatus === 'PARTIALLY_PAID') partiallyPaidInvoices++;
      else if (inv.paymentStatus === 'UNPAID') unpaidInvoices++;

      if (inv.outstandingAmount > 0 && inv.dueDate && new Date(inv.dueDate) < now) {
        overdueInvoices++;
      }
    }

    // 5. Sales by Branch Breakdown
    const salesByBranch = allOutlets.map((outlet) => {
      const branchInvoices = salesInvoices.filter((inv) => inv.outletId === outlet.id);
      const branchSales = branchInvoices.reduce((acc, inv) => acc + inv.totalAmount, 0);
      return {
        outletId: outlet.id,
        outletName: outlet.name,
        outletCode: outlet.code,
        totalSales: branchSales,
        invoiceCount: branchInvoices.length,
      };
    });

    // 6. Top Selling Products
    const productStatsMap = new Map<
      string,
      {
        productId?: string;
        productName: string;
        name: string;
        quantity: number;
        totalQuantity: number;
        revenue: number;
        totalRevenue: number;
      }
    >();
    for (const inv of salesInvoices) {
      for (const item of inv.items) {
        const key = item.productId || item.description;
        const current = productStatsMap.get(key) || {
          productId: item.productId || undefined,
          productName: item.description,
          name: item.description,
          quantity: 0,
          totalQuantity: 0,
          revenue: 0,
          totalRevenue: 0,
        };
        current.quantity += item.quantity;
        current.totalQuantity += item.quantity;
        current.revenue += item.totalAmount;
        current.totalRevenue += item.totalAmount;
        productStatsMap.set(key, current);
      }
    }

    const topSellingProducts = Array.from(productStatsMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // 7. Quotations & Receipts Aggregates
    const allOrgQuotations = await this.prisma.quotation.findMany({
      where: {
        organizationId: orgId,
        ...(outletId ? { outletId } : {}),
      },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        quotationDate: true,
        createdByUserId: true,
        createdAt: true,
      },
    });

    const totalQuotations = allOrgQuotations.length;
    const todayQuotations = allOrgQuotations.filter(
      (q) => q.quotationDate >= startOfToday && q.quotationDate <= endOfToday,
    ).length;
    const acceptedQuotations = allOrgQuotations.filter((q) => q.status === 'ACCEPTED').length;
    const pendingQuotations = allOrgQuotations.filter(
      (q) => q.status === 'DRAFT' || q.status === 'SENT',
    ).length;
    const convertedQuotations = allOrgQuotations.filter((q) => q.status === 'CONVERTED').length;

    const allOrgReceipts = await this.prisma.receipt.findMany({
      where: {
        organizationId: orgId,
        ...(outletId ? { outletId } : {}),
      },
      select: {
        id: true,
        amountPaid: true,
        status: true,
        paymentDate: true,
        createdByUserId: true,
        createdAt: true,
      },
    });

    const validReceipts = allOrgReceipts.filter((r) => r.status !== 'VOIDED');
    const totalReceipts = validReceipts.length;
    const todayReceipts = validReceipts.filter(
      (r) => r.paymentDate >= startOfToday && r.paymentDate <= endOfToday,
    ).length;
    const totalCollected = validReceipts.reduce((acc, r) => acc + r.amountPaid, 0);
    const todayCollected = validReceipts
      .filter((r) => r.paymentDate >= startOfToday && r.paymentDate <= endOfToday)
      .reduce((acc, r) => acc + r.amountPaid, 0);

    const nonCancelledInvoices = allOrgInvoices.filter((i) => i.paymentStatus !== 'CANCELLED');
    const totalInvoiced = nonCancelledInvoices.reduce((acc, i) => acc + i.totalAmount, 0);
    const totalOutstanding = nonCancelledInvoices.reduce((acc, i) => acc + i.outstandingAmount, 0);
    const todayInvoicesCount = todayInvoices.length;

    // 8. Cashier-wise Performance Breakdown
    const cashierUserIds = Array.from(
      new Set([
        ...salesInvoices.map((inv) => inv.createdByUserId).filter(Boolean),
        ...allOrgQuotations.map((q) => q.createdByUserId).filter(Boolean),
        ...allOrgReceipts.map((r) => r.createdByUserId).filter(Boolean),
      ]),
    ) as string[];

    const orgMemberships = await this.prisma.organizationMembership.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            isActive: true,
            lastSeenAt: true,
          },
        },
        membershipRoles: {
          include: { role: true },
        },
        outletMemberships: {
          include: {
            membershipRoles: {
              include: { role: true },
            },
          },
        },
      },
    });

    const cashierUsersMap = new Map<
      string,
      {
        name: string;
        status: 'ACTIVE' | 'INACTIVE';
        isActive: boolean;
        isOnline: boolean;
        lastSeenAt: string | null;
      }
    >();

    const cashierStatsMap = new Map<
      string,
      {
        cashierId: string;
        cashierName: string;
        totalSales: number;
        invoiceCount: number;
        quotationsCreated: number;
        acceptedQuotations: number;
        invoicesCreated: number;
        receiptsGenerated: number;
        totalCollected: number;
        todayCollected: number;
        lastActivity: string | null;
        status: 'ACTIVE' | 'INACTIVE';
        isActive: boolean;
        isOnline: boolean;
        lastSeenAt: string | null;
      }
    >();

    for (const m of orgMemberships) {
      const isActivityUser = cashierUserIds.includes(m.userId);
      const isCashierRole =
        m.membershipRoles.some(
          (mr) =>
            mr.role?.code === 'CASHIER' ||
            mr.role?.name?.toLowerCase().includes('cashier'),
        ) ||
        m.outletMemberships.some((om) =>
          om.membershipRoles.some(
            (mr) =>
              mr.role?.code === 'CASHIER' ||
              mr.role?.name?.toLowerCase().includes('cashier'),
          ),
        );

      const isStaffCashier = isCashierRole || isActivityUser;

      const userName = `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim() || m.user.email || 'Cashier';
      const isAccountEnabled = (m.status === 'ACTIVE' || m.status === 'Active') && m.user.isActive !== false;
      const isLiveOnline = isAccountEnabled && this.presenceService.isCashierOnline(m.userId, m.user);
      const status: 'ACTIVE' | 'INACTIVE' = isLiveOnline ? 'ACTIVE' : 'INACTIVE';
      const lastSeenAtStr = m.user.lastSeenAt ? m.user.lastSeenAt.toISOString() : null;

      cashierUsersMap.set(m.userId, {
        name: userName,
        status,
        isActive: isLiveOnline,
        isOnline: isLiveOnline,
        lastSeenAt: lastSeenAtStr,
      });

      if (isStaffCashier) {
        const isAssignedToOutlet =
          !outletId ||
          m.outletMemberships.length === 0 ||
          m.outletMemberships.some((om) => om.outletId === outletId) ||
          isActivityUser;
        if (isAssignedToOutlet) {
          cashierStatsMap.set(m.userId, {
            cashierId: m.userId,
            cashierName: userName,
            totalSales: 0,
            invoiceCount: 0,
            quotationsCreated: 0,
            acceptedQuotations: 0,
            invoicesCreated: 0,
            receiptsGenerated: 0,
            totalCollected: 0,
            todayCollected: 0,
            lastActivity: lastSeenAtStr,
            status,
            isActive: isLiveOnline,
            isOnline: isLiveOnline,
            lastSeenAt: lastSeenAtStr,
          });
        }
      }
    }

    for (const inv of salesInvoices) {
      const cId = inv.createdByUserId;
      if (!cId) continue;
      const current = cashierStatsMap.get(cId);
      if (current) {
        current.totalSales += inv.totalAmount;
        current.invoiceCount += 1;
        current.invoicesCreated += 1;
        const invDate = inv.createdAt.toISOString();
        if (!current.lastActivity || invDate > current.lastActivity) {
          current.lastActivity = invDate;
        }
      }
    }

    for (const q of allOrgQuotations) {
      const cId = q.createdByUserId;
      if (!cId) continue;
      const current = cashierStatsMap.get(cId);
      if (current) {
        current.quotationsCreated += 1;
        if (q.status === 'ACCEPTED') current.acceptedQuotations += 1;
        const qDate = q.createdAt.toISOString();
        if (!current.lastActivity || qDate > current.lastActivity) {
          current.lastActivity = qDate;
        }
      }
    }

    for (const r of validReceipts) {
      const cId = r.createdByUserId;
      if (!cId) continue;
      const current = cashierStatsMap.get(cId);
      if (current) {
        current.receiptsGenerated += 1;
        current.totalCollected += r.amountPaid;
        if (r.paymentDate >= startOfToday && r.paymentDate <= endOfToday) {
          current.todayCollected += r.amountPaid;
        }
        const rDate = r.createdAt.toISOString();
        if (!current.lastActivity || rDate > current.lastActivity) {
          current.lastActivity = rDate;
        }
      }
    }

    const cashierPerformance = Array.from(cashierStatsMap.values()).sort(
      (a, b) => b.totalSales - a.totalSales,
    );

    // 9. Recent Sales Formatted
    const recentSalesFormatted = recentInvoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customer?.name || 'Walk-in Customer',
      outletName: inv.outlet?.name || 'Main Branch',
      cashierName: inv.createdByUserId
        ? cashierUsersMap.get(inv.createdByUserId)?.name || 'Cashier'
        : 'Counter POS',
      totalAmount: inv.totalAmount,
      paidAmount: inv.paidAmount,
      outstandingAmount: inv.outstandingAmount,
      paymentStatus: inv.paymentStatus,
      isPosSale: inv.isPosSale,
      createdAt: inv.createdAt,
    }));

    return {
      todaySales,
      todayGrossMargin,
      todayGrossProfit,
      todaySalesCount,
      totalSales,
      totalPurchases,
      cogs,
      grossProfit,
      grossMargin,
      totalExpenses,
      netProfit,
      customerReceivables,
      supplierPayables,
      activeDiningTables,
      totalInvoices: allOrgInvoices.length,
      todayInvoices: todayInvoicesCount,
      paidInvoices,
      partiallyPaidInvoices,
      unpaidInvoices,
      overdueInvoices,
      totalInvoiced,
      totalCollected,
      totalOutstanding,
      totalQuotations,
      todayQuotations,
      acceptedQuotations,
      pendingQuotations,
      convertedQuotations,
      totalReceipts,
      todayReceipts,
      outputGst,
      inputGst,
      netGstPayable,
      salesByBranch,
      topSellingProducts,
      lowStockProducts: lowStockProducts.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        stockQty: p.stockQty,
        sellingPrice: p.sellingPrice,
      })),
      cashierPerformance,
      recentSales: recentSalesFormatted,
    };
  }

  // ---------------------------------------------------------
  // 2. Sales Invoices Management
  // ---------------------------------------------------------
  async getSalesInvoices(
    tenantContext: TenantContext,
    query?: {
      search?: string;
      outletId?: string;
      paymentStatus?: string;
      customerId?: string;
      cashierId?: string;
      startDate?: string;
      endDate?: string;
    },
    currentUserId?: string,
  ) {
    const orgId = tenantContext.organizationId;
    const isOwner = this.isOwnerOrManager(tenantContext);
    const userId = currentUserId || tenantContext.userId;
    const outletId = this.getOutletFilter(tenantContext, query?.outletId);

    const where: any = { organizationId: orgId };

    // Cashier Scope: Cashiers can only view their own invoices
    if (!isOwner) {
      where.createdByUserId = userId;
    } else if (query?.cashierId && query.cashierId !== 'ALL') {
      where.createdByUserId = query.cashierId;
    }

    if (outletId) where.outletId = outletId;
    if (query?.paymentStatus && query.paymentStatus !== 'ALL') where.paymentStatus = query.paymentStatus;
    if (query?.customerId && query.customerId !== 'ALL') where.customerId = query.customerId;
    if (query?.search) {
      where.OR = [
        { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
        { customer: { name: { contains: query.search, mode: 'insensitive' } } },
        { customer: { phone: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    if (query?.startDate || query?.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    return this.prisma.saleInvoice.findMany({
      where,
      include: {
        customer: true,
        outlet: { select: { id: true, name: true, code: true } },
        createdByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        items: true,
        payments: true,
        receipts: {
          select: {
            id: true,
            receiptNumber: true,
            amountPaid: true,
            paymentMethod: true,
            status: true,
            paymentDate: true,
          },
        },
        quotation: { select: { id: true, quotationNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSalesInvoiceDetail(tenantContext: TenantContext, id: string, currentUserId?: string) {
    const orgId = tenantContext.organizationId;
    const isOwner = this.isOwnerOrManager(tenantContext);
    const userId = currentUserId || tenantContext.userId;

    const invoice = await this.prisma.saleInvoice.findFirst({
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
        payments: true,
        receipts: {
          include: {
            createdByUser: { select: { id: true, firstName: true, lastName: true } },
            voidedByUser: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { paymentDate: 'desc' },
        },
        quotation: true,
      },
    });

    if (!invoice) throw new NotFoundException('Sales invoice not found or access denied.');
    return invoice;
  }

  async createSalesInvoice(
    tenantContext: TenantContext,
    dto: {
      outletId?: string;
      customerId?: string;
      items: {
        productId?: string;
        description: string;
        quantity: number;
        unitPrice: number;
        unitCost?: number;
        discountAmount?: number;
        taxRate?: number;
      }[];
      discountPercent?: number;
      additionalCharges?: number;
      paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT' | 'RAZORPAY';
      paidAmount?: number;
      dueDate?: string;
      isPosSale?: boolean;
      termsAndConditions?: string;
      notes?: string;
    },
    currentUserId?: string,
  ) {
    if (!tenantContext || !tenantContext.organizationId) {
      throw new BadRequestException('Organization context is required.');
    }
    const orgId = tenantContext.organizationId;
    const outletId = dto.outletId || tenantContext.outletId;
    const userId = currentUserId || tenantContext.userId;

    if (!outletId) {
      throw new BadRequestException('Branch / Outlet is required for billing.');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Cannot create invoice without line items.');
    }

    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, organizationId: orgId },
    });
    if (!outlet) {
      throw new BadRequestException('Outlet not found in current organization.');
    }

    // Validate product permissions & load DB products for accurate cost calculations
    const productIds = dto.items.map((it) => it.productId).filter(Boolean) as string[];
    const dbProducts = productIds.length > 0
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds }, organizationId: orgId },
          include: { outletAccess: true, cashierAccess: true },
        })
      : [];
    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    const isCashierOnly =
      tenantContext.roles?.includes('CASHIER') &&
      !tenantContext.roles?.includes('OWNER') &&
      !tenantContext.roles?.includes('MANAGER') &&
      !tenantContext.roles?.includes('SUPER_ADMIN_SUPPORT');

    if (isCashierOnly) {
      for (const p of dbProducts) {
        const hasRestrictions = p.outletAccess.length > 0 || p.cashierAccess.length > 0;
        if (hasRestrictions) {
          const matchesOutlet = outletId && p.outletAccess.some((oa) => oa.outletId === outletId);
          const matchesUser = userId && p.cashierAccess.some((ca) => ca.userId === userId);
          if (!matchesOutlet && !matchesUser) {
            throw new ForbiddenException(
              `Access Denied: Product '${p.name}' is not authorized for your branch or cashier account.`,
            );
          }
        }
      }
    }

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
      const lineDiscount = item.discountAmount !== undefined
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
        item.unitCost !== undefined && item.unitCost !== null && item.unitCost > 0
          ? item.unitCost
          : (dbProduct?.costPrice || 0),
      );

      return {
        productId: item.productId || null,
        description: item.description || dbProduct?.name || 'Item',
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
    const isCredit = dto.paymentMethod === 'CREDIT' || dto.paymentMethod === 'RAZORPAY';
    const paidAmount = isCredit ? (Number(dto.paidAmount) || 0) : totalAmount;
    const outstandingAmount = Math.max(0, totalAmount - paidAmount);
    const paymentStatus = outstandingAmount === 0 ? 'PAID' : paidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

    const activeSession = await this.prisma.registerSession.findFirst({
      where: {
        organizationId: orgId,
        outletId,
        openedByUserId: userId,
        status: 'OPEN',
      },
      orderBy: { openedAt: 'desc' },
    });

    return this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await generateDocumentNumber(tx, orgId, 'INVOICE');

      const invoice = await tx.saleInvoice.create({
        data: {
          invoiceNumber,
          organizationId: orgId,
          outletId,
          customerId: dto.customerId || null,
          registerSessionId: activeSession?.id || null,
          subtotal,
          discountAmount: totalDiscount,
          taxableAmount,
          cgstAmount,
          sgstAmount,
          igstAmount: 0,
          additionalCharges,
          totalAmount,
          paidAmount,
          outstandingAmount,
          paymentStatus,
          isPosSale: dto.isPosSale !== undefined ? dto.isPosSale : true,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          termsAndConditions: dto.termsAndConditions || null,
          notes: dto.notes || null,
          createdByUserId: userId || null,
          items: {
            create: processedItems,
          },
        },
      });

      if (paidAmount > 0) {
        const paymentNumber = await generateDocumentNumber(tx, orgId, 'RECEIPT');
        const payment = await tx.payment.create({
          data: {
            paymentNumber,
            organizationId: orgId,
            outletId,
            type: 'CUSTOMER_RECEIPT',
            customerId: dto.customerId || null,
            invoiceId: invoice.id,
            registerSessionId: activeSession?.id || null,
            amount: paidAmount,
            paymentMethod: dto.paymentMethod || 'CASH',
            status: 'COMPLETED',
            createdByUserId: userId || null,
            notes: dto.notes || `Payment for ${invoiceNumber}`,
          },
        });

        await tx.receipt.create({
          data: {
            receiptNumber: paymentNumber,
            organizationId: orgId,
            outletId,
            invoiceId: invoice.id,
            paymentId: payment.id,
            customerId: dto.customerId || null,
            amountPaid: paidAmount,
            previouslyPaid: 0,
            totalPaid: paidAmount,
            remainingBalance: outstandingAmount,
            paymentMethod: dto.paymentMethod || 'CASH',
            paymentDate: new Date(),
            status: 'ISSUED',
            notes: dto.notes || `Receipt for ${invoiceNumber}`,
            createdByUserId: userId || null,
          },
        });

        if (dto.paymentMethod === 'CASH' && activeSession) {
          await tx.registerSession.update({
            where: { id: activeSession.id },
            data: {
              cashSales: { increment: paidAmount },
            },
          });
        }
      }

      if (dto.customerId && outstandingAmount > 0) {
        await tx.customer.update({
          where: { id: dto.customerId },
          data: {
            outstandingBalance: { increment: outstandingAmount },
          },
        });
      }

      for (const item of processedItems) {
        if (item.productId) {
          await tx.product.updateMany({
            where: { id: item.productId, organizationId: orgId },
            data: {
              stockQty: { decrement: item.quantity },
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          outletId,
          userId: userId || null,
          action: 'SALE_INVOICE_CREATED',
          resource: 'SaleInvoice',
          resourceId: invoice.id,
          afterState: JSON.stringify({
            invoiceNumber,
            totalAmount,
            paymentStatus,
            paymentMethod: dto.paymentMethod,
            itemsCount: processedItems.length,
          }),
        },
      });

      this.presenceGateway.broadcastEvent(orgId, 'invoice:created', {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId,
        totalAmount: invoice.totalAmount,
        paidAmount: invoice.paidAmount,
        outstandingAmount: invoice.outstandingAmount,
        paymentStatus: invoice.paymentStatus,
        createdByUserId: userId,
      });

      return tx.saleInvoice.findUnique({
        where: { id: invoice.id },
        include: {
          items: {
            include: { product: true },
          },
          outlet: true,
          organization: true,
          customer: true,
          payments: true,
          receipts: true,
        },
      });
    }, {
      maxWait: 10_000,
      timeout: 30_000,
    });
  }

  async recordInvoicePayment(
    tenantContext: TenantContext,
    invoiceId: string,
    dto: {
      amount: number;
      paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';
      referenceNumber?: string;
      notes?: string;
    },
    currentUserId?: string,
  ) {
    const orgId = tenantContext.organizationId;
    const userId = currentUserId || tenantContext.userId;
    const isOwner = this.isOwnerOrManager(tenantContext);

    const amount = Number(dto.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero.');
    }

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.saleInvoice.findFirst({
        where: {
          id: invoiceId,
          organizationId: orgId,
          ...(!isOwner ? { createdByUserId: userId } : {}),
        },
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found or access denied.');
      }

      if (invoice.paymentStatus === 'PAID' || invoice.outstandingAmount <= 0) {
        throw new BadRequestException('This invoice is already fully paid.');
      }

      if (amount > invoice.outstandingAmount) {
        throw new BadRequestException(
          `Payment amount (₹${amount.toFixed(2)}) exceeds outstanding balance (₹${invoice.outstandingAmount.toFixed(2)}).`,
        );
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

      const newPaid = invoice.paidAmount + amount;
      const newOutstanding = Math.max(0, invoice.totalAmount - newPaid);
      const newPaymentStatus =
        newOutstanding === 0 ? 'PAID' : 'PARTIALLY_PAID';

      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          organizationId: orgId,
          outletId: invoice.outletId,
          type: 'CUSTOMER_RECEIPT',
          customerId: invoice.customerId,
          invoiceId: invoice.id,
          registerSessionId: activeSession?.id || null,
          amount,
          paymentMethod: dto.paymentMethod,
          referenceNumber: dto.referenceNumber || null,
          status: 'COMPLETED',
          createdByUserId: userId || null,
          notes: dto.notes || `Payment towards ${invoice.invoiceNumber}`,
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
          amountPaid: amount,
          previouslyPaid: invoice.paidAmount,
          totalPaid: newPaid,
          remainingBalance: newOutstanding,
          paymentMethod: dto.paymentMethod,
          referenceNumber: dto.referenceNumber || null,
          paymentDate: new Date(),
          status: 'ISSUED',
          notes: dto.notes || `Payment towards ${invoice.invoiceNumber}`,
          createdByUserId: userId || null,
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
            outstandingBalance: { decrement: amount },
          },
        });
      }

      if (dto.paymentMethod === 'CASH' && activeSession) {
        await tx.registerSession.update({
          where: { id: activeSession.id },
          data: {
            cashSales: { increment: amount },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          outletId: invoice.outletId,
          userId: userId || null,
          action: 'INVOICE_PAYMENT_RECORDED',
          resource: 'SaleInvoice',
          resourceId: invoice.id,
          afterState: JSON.stringify({
            invoiceNumber: invoice.invoiceNumber,
            receiptNumber: paymentNumber,
            amountPaid: amount,
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
        amountPaid: amount,
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
        payment,
        receipt,
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          paidAmount: newPaid,
          outstandingAmount: newOutstanding,
          paymentStatus: newPaymentStatus,
        },
      };
    }, {
      maxWait: 10_000,
      timeout: 30_000,
    });
  }

  async cancelSalesInvoice(
    tenantContext: TenantContext,
    id: string,
    reason: string,
    currentUserId?: string,
  ) {
    const orgId = tenantContext.organizationId;
    const isOwner = this.isOwnerOrManager(tenantContext);
    const userId = currentUserId || tenantContext.userId;

    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('A reason is required to cancel an invoice.');
    }

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.saleInvoice.findFirst({
        where: {
          id,
          organizationId: orgId,
          ...(!isOwner ? { createdByUserId: userId } : {}),
        },
        include: {
          items: true,
          payments: { where: { status: 'COMPLETED' } },
        },
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found or access denied.');
      }

      if (invoice.paymentStatus === 'CANCELLED') {
        throw new BadRequestException('Invoice is already cancelled.');
      }

      if (invoice.payments.length > 0 && invoice.paidAmount > 0) {
        throw new BadRequestException(
          'Cannot cancel an invoice with active payments. Please void all associated receipts/payments first.',
        );
      }

      // 1. Restore product stock
      for (const item of invoice.items) {
        if (item.productId) {
          await tx.product.updateMany({
            where: { id: item.productId, organizationId: orgId },
            data: {
              stockQty: { increment: item.quantity },
            },
          });
        }
      }

      // 2. Adjust customer balance if credit outstanding existed
      if (invoice.customerId && invoice.outstandingAmount > 0) {
        await tx.customer.update({
          where: { id: invoice.customerId },
          data: {
            outstandingBalance: { decrement: invoice.outstandingAmount },
          },
        });
      }

      // 3. Mark invoice as CANCELLED
      const updated = await tx.saleInvoice.update({
        where: { id },
        data: {
          paymentStatus: 'CANCELLED',
          cancelReason: reason,
        },
        include: {
          customer: true,
          outlet: true,
          items: true,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          outletId: invoice.outletId,
          userId: userId || null,
          action: 'SALE_INVOICE_CANCELLED',
          resource: 'SaleInvoice',
          resourceId: invoice.id,
          afterState: JSON.stringify({
            invoiceNumber: invoice.invoiceNumber,
            cancelReason: reason,
          }),
        },
      });

      this.presenceGateway.broadcastEvent(orgId, 'invoice:cancelled', {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        cancelReason: reason,
      });

      return updated;
    }, {
      maxWait: 10_000,
      timeout: 30_000,
    });
  }

  // ---------------------------------------------------------
  // 3. Purchase Bills Management
  // ---------------------------------------------------------
  async getPurchaseBills(tenantContext: TenantContext, query?: {
    search?: string;
    outletId?: string;
    paymentStatus?: string;
    supplierId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const orgId = tenantContext.organizationId;
    const outletId = this.getOutletFilter(tenantContext, query?.outletId);

    const where: any = { organizationId: orgId };
    if (outletId) where.outletId = outletId;
    if (query?.paymentStatus && query.paymentStatus !== 'ALL') where.paymentStatus = query.paymentStatus;
    if (query?.supplierId && query.supplierId !== 'ALL') where.supplierId = query.supplierId;
    if (query?.search) {
      where.OR = [
        { billNumber: { contains: query.search, mode: 'insensitive' } },
        { supplierInvoiceNumber: { contains: query.search, mode: 'insensitive' } },
        { supplier: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    if (query?.startDate || query?.endDate) {
      where.purchaseDate = {};
      if (query.startDate) where.purchaseDate.gte = new Date(query.startDate);
      if (query.endDate) where.purchaseDate.lte = new Date(query.endDate);
    }

    return this.prisma.purchaseBill.findMany({
      where,
      include: {
        supplier: true,
        outlet: { select: { id: true, name: true, code: true } },
        items: true,
        payments: true,
      },
      orderBy: { purchaseDate: 'desc' },
    });
  }

  async getPurchaseBillDetail(tenantContext: TenantContext, id: string) {
    const bill = await this.prisma.purchaseBill.findFirst({
      where: { id, organizationId: tenantContext.organizationId },
      include: {
        supplier: true,
        outlet: true,
        items: {
          include: { product: true },
        },
        payments: true,
      },
    });

    if (!bill) throw new NotFoundException('Purchase bill not found.');
    return bill;
  }

  // ---------------------------------------------------------
  // 4. Payments & Receipts Management
  // ---------------------------------------------------------
  async getPayments(tenantContext: TenantContext, query?: {
    type?: string;
    paymentMethod?: string;
    outletId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const orgId = tenantContext.organizationId;
    const outletId = this.getOutletFilter(tenantContext, query?.outletId);

    const where: any = { organizationId: orgId };
    if (outletId) where.outletId = outletId;
    if (query?.type && query.type !== 'ALL') where.type = query.type;
    if (query?.paymentMethod && query.paymentMethod !== 'ALL') where.paymentMethod = query.paymentMethod;
    if (query?.startDate || query?.endDate) {
      where.transactionDate = {};
      if (query.startDate) where.transactionDate.gte = new Date(query.startDate);
      if (query.endDate) where.transactionDate.lte = new Date(query.endDate);
    }

    return this.prisma.payment.findMany({
      where,
      include: {
        customer: true,
        supplier: true,
        invoice: { select: { id: true, invoiceNumber: true, totalAmount: true } },
        purchaseBill: { select: { id: true, billNumber: true, totalAmount: true } },
        outlet: { select: { id: true, name: true } },
      },
      orderBy: { transactionDate: 'desc' },
    });
  }

  async createPayment(tenantContext: TenantContext, dto: {
    type: 'CUSTOMER_RECEIPT' | 'SUPPLIER_PAYMENT' | 'REFUND';
    customerId?: string;
    supplierId?: string;
    invoiceId?: string;
    purchaseBillId?: string;
    amount: number;
    paymentMethod: string;
    referenceNumber?: string;
    notes?: string;
  }) {
    const orgId = tenantContext.organizationId;
    const outletId = tenantContext.outletId;

    if (dto.amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero.');
    }

    const count = await this.prisma.payment.count({ where: { organizationId: orgId } });
    const paymentNumber = dto.type === 'CUSTOMER_RECEIPT'
      ? `RCPT-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`
      : `PAY-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    const payment = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          organizationId: orgId,
          outletId,
          paymentNumber,
          type: dto.type,
          customerId: dto.customerId,
          supplierId: dto.supplierId,
          invoiceId: dto.invoiceId,
          purchaseBillId: dto.purchaseBillId,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          referenceNumber: dto.referenceNumber,
          notes: dto.notes,
          createdByUserId: tenantContext.userId,
        },
      });

      // Update Sales Invoice if linked
      if (dto.invoiceId) {
        const inv = await tx.saleInvoice.findUnique({ where: { id: dto.invoiceId } });
        if (inv) {
          const newPaid = inv.paidAmount + dto.amount;
          const newOutstanding = Math.max(0, inv.totalAmount - newPaid);
          const newStatus = newOutstanding === 0 ? 'PAID' : 'PARTIALLY_PAID';
          await tx.saleInvoice.update({
            where: { id: inv.id },
            data: { paidAmount: newPaid, outstandingAmount: newOutstanding, paymentStatus: newStatus },
          });

          if (inv.customerId) {
            await tx.customer.update({
              where: { id: inv.customerId },
              data: { outstandingBalance: { decrement: dto.amount } },
            });
          }
        }
      }

      // Update Purchase Bill if linked
      if (dto.purchaseBillId) {
        const bill = await tx.purchaseBill.findUnique({ where: { id: dto.purchaseBillId } });
        if (bill) {
          const newPaid = bill.paidAmount + dto.amount;
          const newOutstanding = Math.max(0, bill.totalAmount - newPaid);
          const newStatus = newOutstanding === 0 ? 'PAID' : 'PARTIALLY_PAID';
          await tx.purchaseBill.update({
            where: { id: bill.id },
            data: { paidAmount: newPaid, outstandingAmount: newOutstanding, paymentStatus: newStatus },
          });

          await tx.supplier.update({
            where: { id: bill.supplierId },
            data: { outstandingBalance: { decrement: dto.amount } },
          });
        }
      }

      // Audit Log
      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          outletId,
          userId: tenantContext.userId,
          action: `FINANCE_${dto.type}_RECORDED`,
          resource: 'Payment',
          resourceId: p.id,
          afterState: JSON.stringify(p),
        },
      });

      return p;
    }, {
      maxWait: 10_000,
      timeout: 30_000,
    });

    return payment;
  }

  // ---------------------------------------------------------
  // 5. Accounts Receivable Aging
  // ---------------------------------------------------------
  async getAccountsReceivable(tenantContext: TenantContext, query?: { outletId?: string }) {
    const orgId = tenantContext.organizationId;
    const outletId = this.getOutletFilter(tenantContext, query?.outletId);

    const invoices = await this.prisma.saleInvoice.findMany({
      where: {
        organizationId: orgId,
        ...(outletId ? { outletId } : {}),
        outstandingAmount: { gt: 0 },
        paymentStatus: { not: 'CANCELLED' },
      },
      include: { customer: true, outlet: true },
      orderBy: { dueDate: 'asc' },
    });

    const now = new Date();
    const buckets = {
      current: 0,
      days1_30: 0,
      days31_60: 0,
      days61_90: 0,
      days90Plus: 0,
      total: 0,
    };

    const items = invoices.map((inv) => {
      const dueDate = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.createdAt);
      const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysOverdue = Math.max(0, diffDays);

      let bucket: string;
      if (daysOverdue === 0) {
        bucket = 'Current';
        buckets.current += inv.outstandingAmount;
      } else if (daysOverdue <= 30) {
        bucket = '1â€“30 Days';
        buckets.days1_30 += inv.outstandingAmount;
      } else if (daysOverdue <= 60) {
        bucket = '31â€“60 Days';
        buckets.days31_60 += inv.outstandingAmount;
      } else if (daysOverdue <= 90) {
        bucket = '61â€“90 Days';
        buckets.days61_90 += inv.outstandingAmount;
      } else {
        bucket = '90+ Days';
        buckets.days90Plus += inv.outstandingAmount;
      }

      buckets.total += inv.outstandingAmount;

      return {
        id: inv.id,
        customerName: inv.customer?.name || 'Retail Walk-In',
        customerPhone: inv.customer?.phone,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.createdAt,
        dueDate: inv.dueDate,
        totalAmount: inv.totalAmount,
        paidAmount: inv.paidAmount,
        outstandingAmount: inv.outstandingAmount,
        daysOverdue,
        bucket,
        status: inv.paymentStatus,
        outletName: inv.outlet.name,
      };
    });

    return { buckets, items };
  }

  // ---------------------------------------------------------
  // 6. Accounts Payable Aging
  // ---------------------------------------------------------
  async getAccountsPayable(tenantContext: TenantContext, query?: { outletId?: string }) {
    const orgId = tenantContext.organizationId;
    const outletId = this.getOutletFilter(tenantContext, query?.outletId);

    const bills = await this.prisma.purchaseBill.findMany({
      where: {
        organizationId: orgId,
        ...(outletId ? { outletId } : {}),
        outstandingAmount: { gt: 0 },
        paymentStatus: { not: 'CANCELLED' },
      },
      include: { supplier: true, outlet: true },
      orderBy: { dueDate: 'asc' },
    });

    const now = new Date();
    const buckets = {
      current: 0,
      days1_30: 0,
      days31_60: 0,
      days61_90: 0,
      days90Plus: 0,
      total: 0,
    };

    const items = bills.map((b) => {
      const dueDate = b.dueDate ? new Date(b.dueDate) : new Date(b.purchaseDate);
      const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysOverdue = Math.max(0, diffDays);

      let bucket: string;
      if (daysOverdue === 0) {
        bucket = 'Current';
        buckets.current += b.outstandingAmount;
      } else if (daysOverdue <= 30) {
        bucket = '1â€“30 Days';
        buckets.days1_30 += b.outstandingAmount;
      } else if (daysOverdue <= 60) {
        bucket = '31â€“60 Days';
        buckets.days31_60 += b.outstandingAmount;
      } else if (daysOverdue <= 90) {
        bucket = '61â€“90 Days';
        buckets.days61_90 += b.outstandingAmount;
      } else {
        bucket = '90+ Days';
        buckets.days90Plus += b.outstandingAmount;
      }

      buckets.total += b.outstandingAmount;

      return {
        id: b.id,
        supplierName: b.supplier.name,
        supplierInvoiceNumber: b.supplierInvoiceNumber,
        billNumber: b.billNumber,
        purchaseDate: b.purchaseDate,
        dueDate: b.dueDate,
        totalAmount: b.totalAmount,
        paidAmount: b.paidAmount,
        outstandingAmount: b.outstandingAmount,
        daysOverdue,
        bucket,
        status: b.paymentStatus,
        outletName: b.outlet.name,
      };
    });

    return { buckets, items };
  }

  // ---------------------------------------------------------
  // 7. Expenses Management
  // ---------------------------------------------------------
  async getExpenses(tenantContext: TenantContext, query?: {
    category?: string;
    paymentMethod?: string;
    outletId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const orgId = tenantContext.organizationId;
    const outletId = this.getOutletFilter(tenantContext, query?.outletId);

    const where: any = { organizationId: orgId };
    if (outletId) where.outletId = outletId;
    if (query?.category && query.category !== 'ALL') where.category = query.category;
    if (query?.paymentMethod && query.paymentMethod !== 'ALL') where.paymentMethod = query.paymentMethod;
    if (query?.startDate || query?.endDate) {
      where.expenseDate = {};
      if (query.startDate) where.expenseDate.gte = new Date(query.startDate);
      if (query.endDate) where.expenseDate.lte = new Date(query.endDate);
    }

    return this.prisma.expense.findMany({
      where,
      include: { outlet: { select: { id: true, name: true } } },
      orderBy: { expenseDate: 'desc' },
    });
  }

  async createExpense(tenantContext: TenantContext, dto: {
    category: string;
    description: string;
    amount: number;
    taxAmount?: number;
    paymentMethod: string;
    expenseDate?: string;
    vendorName?: string;
    referenceNumber?: string;
  }) {
    const orgId = tenantContext.organizationId;
    const outletId = tenantContext.outletId;

    if (dto.amount <= 0) {
      throw new BadRequestException('Expense amount must be positive.');
    }

    const count = await this.prisma.expense.count({ where: { organizationId: orgId } });
    const expenseNumber = `EXP-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    const expense = await this.prisma.expense.create({
      data: {
        organizationId: orgId,
        outletId,
        expenseNumber,
        category: dto.category,
        description: dto.description,
        amount: dto.amount,
        taxAmount: dto.taxAmount || 0.0,
        paymentMethod: dto.paymentMethod,
        expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : new Date(),
        vendorName: dto.vendorName,
        referenceNumber: dto.referenceNumber,
        status: 'PAID',
        createdByUserId: tenantContext.userId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        outletId,
        userId: tenantContext.userId,
        action: 'FINANCE_EXPENSE_CREATED',
        resource: 'Expense',
        resourceId: expense.id,
        afterState: JSON.stringify(expense),
      },
    });

    return expense;
  }

  // ---------------------------------------------------------
  // 8. Cash & Bank Activity
  // ---------------------------------------------------------
  async getCashBankActivity(tenantContext: TenantContext, query?: { outletId?: string }) {
    const orgId = tenantContext.organizationId;
    const outletId = this.getOutletFilter(tenantContext, query?.outletId);

    const [sessions, digitalPayments, cashPayments] = await Promise.all([
      this.prisma.registerSession.findMany({
        where: { organizationId: orgId, ...(outletId ? { outletId } : {}) },
        include: { outlet: true },
        orderBy: { openedAt: 'desc' },
        take: 10,
      }),
      this.prisma.payment.findMany({
        where: {
          organizationId: orgId,
          ...(outletId ? { outletId } : {}),
          paymentMethod: { in: ['UPI', 'CARD', 'BANK_TRANSFER'] },
        },
        include: { customer: true, supplier: true, outlet: true },
        orderBy: { transactionDate: 'desc' },
        take: 20,
      }),
      this.prisma.payment.findMany({
        where: {
          organizationId: orgId,
          ...(outletId ? { outletId } : {}),
          paymentMethod: 'CASH',
        },
        include: { customer: true, supplier: true, outlet: true },
        orderBy: { transactionDate: 'desc' },
        take: 20,
      }),
    ]);

    return { sessions, digitalPayments, cashPayments };
  }

  // ---------------------------------------------------------
  // 9. Transaction-Derived Sub-Ledgers
  // ---------------------------------------------------------
  async getLedgers(tenantContext: TenantContext, query?: {
    ledgerType?: 'sales' | 'purchase' | 'expense' | 'customer' | 'supplier' | 'cash' | 'bank';
    entityId?: string;
    outletId?: string;
  }) {
    const orgId = tenantContext.organizationId;
    const outletId = this.getOutletFilter(tenantContext, query?.outletId);
    const type = query?.ledgerType || 'sales';

    const entries: any[] = [];
    let runningBalance = 0;

    if (type === 'sales') {
      const invoices = await this.prisma.saleInvoice.findMany({
        where: { organizationId: orgId, ...(outletId ? { outletId } : {}), paymentStatus: { not: 'CANCELLED' } },
        include: { customer: true, outlet: true },
        orderBy: { createdAt: 'asc' },
      });

      for (const inv of invoices) {
        runningBalance += inv.totalAmount;
        entries.push({
          id: inv.id,
          date: inv.createdAt,
          reference: inv.invoiceNumber,
          description: `Sales Invoice - ${inv.customer?.name || 'Retail Sale'}`,
          debit: inv.totalAmount,
          credit: 0,
          runningBalance,
          outletName: inv.outlet.name,
        });
      }
    } else if (type === 'purchase') {
      const bills = await this.prisma.purchaseBill.findMany({
        where: { organizationId: orgId, ...(outletId ? { outletId } : {}), paymentStatus: { not: 'CANCELLED' } },
        include: { supplier: true, outlet: true },
        orderBy: { purchaseDate: 'asc' },
      });

      for (const b of bills) {
        runningBalance += b.totalAmount;
        entries.push({
          id: b.id,
          date: b.purchaseDate,
          reference: b.billNumber,
          description: `Purchase Bill - ${b.supplier.name}`,
          debit: 0,
          credit: b.totalAmount,
          runningBalance,
          outletName: b.outlet.name,
        });
      }
    } else if (type === 'expense') {
      const expenses = await this.prisma.expense.findMany({
        where: { organizationId: orgId, ...(outletId ? { outletId } : {}), status: 'PAID' },
        include: { outlet: true },
        orderBy: { expenseDate: 'asc' },
      });

      for (const exp of expenses) {
        runningBalance += exp.amount;
        entries.push({
          id: exp.id,
          date: exp.expenseDate,
          reference: exp.expenseNumber,
          description: `${exp.category}: ${exp.description}`,
          debit: exp.amount,
          credit: 0,
          runningBalance,
          outletName: exp.outlet.name,
        });
      }
    } else if (type === 'customer') {
      const invoices = await this.prisma.saleInvoice.findMany({
        where: { organizationId: orgId, customerId: query?.entityId || undefined, paymentStatus: { not: 'CANCELLED' } },
        include: { customer: true, outlet: true },
        orderBy: { createdAt: 'asc' },
      });
      const payments = await this.prisma.payment.findMany({
        where: { organizationId: orgId, customerId: query?.entityId || undefined, type: 'CUSTOMER_RECEIPT' },
        include: { customer: true, outlet: true },
        orderBy: { transactionDate: 'asc' },
      });

      const combined = [
        ...invoices.map((inv) => ({ date: inv.createdAt, inv })),
        ...payments.map((p) => ({ date: p.transactionDate, p })),
      ].sort((a, b) => a.date.getTime() - b.date.getTime());

      for (const item of combined) {
        if ('inv' in item) {
          runningBalance += item.inv.totalAmount;
          entries.push({
            id: item.inv.id,
            date: item.inv.createdAt,
            reference: item.inv.invoiceNumber,
            description: `Invoice Raised`,
            debit: item.inv.totalAmount,
            credit: 0,
            runningBalance,
            outletName: item.inv.outlet.name,
          });
        } else if ('p' in item) {
          runningBalance -= item.p.amount;
          entries.push({
            id: item.p.id,
            date: item.p.transactionDate,
            reference: item.p.paymentNumber,
            description: `Payment Received (${item.p.paymentMethod})`,
            debit: 0,
            credit: item.p.amount,
            runningBalance,
            outletName: item.p.outlet.name,
          });
        }
      }
    }

    return entries.reverse();
  }

  // ---------------------------------------------------------
  // 10. GST & Tax Summary
  // ---------------------------------------------------------
  async getTaxSummary(tenantContext: TenantContext, query?: {
    outletId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const orgId = tenantContext.organizationId;
    const outletId = this.getOutletFilter(tenantContext, query?.outletId);

    const whereSales: any = { organizationId: orgId, paymentStatus: { not: 'CANCELLED' } };
    if (outletId) whereSales.outletId = outletId;
    if (query?.startDate || query?.endDate) {
      whereSales.createdAt = {};
      if (query.startDate) whereSales.createdAt.gte = new Date(query.startDate);
      if (query.endDate) whereSales.createdAt.lte = new Date(query.endDate);
    }

    const wherePurchases: any = { organizationId: orgId, paymentStatus: { not: 'CANCELLED' } };
    if (outletId) wherePurchases.outletId = outletId;
    if (query?.startDate || query?.endDate) {
      wherePurchases.purchaseDate = {};
      if (query.startDate) wherePurchases.purchaseDate.gte = new Date(query.startDate);
      if (query.endDate) wherePurchases.purchaseDate.lte = new Date(query.endDate);
    }

    const [salesInvoices, purchaseBills] = await Promise.all([
      this.prisma.saleInvoice.findMany({
        where: whereSales,
        include: { items: true },
      }),
      this.prisma.purchaseBill.findMany({
        where: wherePurchases,
        include: { items: true },
      }),
    ]);

    // Rate-wise calculation
    const rateBreakdown: Record<number, { taxableSales: number; outputGst: number; taxablePurchases: number; inputGst: number }> = {
      0: { taxableSales: 0, outputGst: 0, taxablePurchases: 0, inputGst: 0 },
      5: { taxableSales: 0, outputGst: 0, taxablePurchases: 0, inputGst: 0 },
      12: { taxableSales: 0, outputGst: 0, taxablePurchases: 0, inputGst: 0 },
      18: { taxableSales: 0, outputGst: 0, taxablePurchases: 0, inputGst: 0 },
      28: { taxableSales: 0, outputGst: 0, taxablePurchases: 0, inputGst: 0 },
    };

    let totalTaxableSales = 0;
    let totalOutputGst = 0;
    let totalTaxablePurchases = 0;
    let totalInputGst = 0;

    for (const inv of salesInvoices) {
      totalTaxableSales += inv.taxableAmount;
      const gst = inv.cgstAmount + inv.sgstAmount + inv.igstAmount;
      totalOutputGst += gst;
      for (const item of inv.items) {
        const rate = Math.round(item.taxRate);
        if (!rateBreakdown[rate]) rateBreakdown[rate] = { taxableSales: 0, outputGst: 0, taxablePurchases: 0, inputGst: 0 };
        rateBreakdown[rate].taxableSales += item.taxableAmount;
        rateBreakdown[rate].outputGst += (item.cgst + item.sgst + item.igst);
      }
    }

    for (const b of purchaseBills) {
      totalTaxablePurchases += b.taxableAmount;
      const gst = b.cgstAmount + b.sgstAmount + b.igstAmount;
      totalInputGst += gst;
      for (const item of b.items) {
        const rate = Math.round(item.taxRate);
        if (!rateBreakdown[rate]) rateBreakdown[rate] = { taxableSales: 0, outputGst: 0, taxablePurchases: 0, inputGst: 0 };
        rateBreakdown[rate].taxablePurchases += item.taxableAmount;
        rateBreakdown[rate].inputGst += (item.cgst + item.sgst + item.igst);
      }
    }

    return {
      summary: {
        totalTaxableSales,
        totalOutputGst,
        totalTaxablePurchases,
        totalInputGst,
        netGstPayable: totalOutputGst - totalInputGst,
      },
      rateBreakdown: Object.entries(rateBreakdown).map(([rate, data]) => ({
        rate: Number(rate),
        ...data,
      })),
    };
  }

  // ---------------------------------------------------------
  // 11. Financial Reports
  // ---------------------------------------------------------
  async getFinancialReports(tenantContext: TenantContext, query?: {
    reportType?: string;
    outletId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    return this.getDashboardSummary(tenantContext, query);
  }

  // ---------------------------------------------------------
  // 12. Tenant-Scoped Products & Catalog
  // ---------------------------------------------------------
  async getProducts(tenantContext: TenantContext, query?: {
    search?: string;
    category?: string;
  }) {
    const orgId = tenantContext.organizationId;
    const where: any = { organizationId: orgId };

    if (query?.category && query.category !== 'ALL') {
      where.category = query.category;
    }

    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
        { barcode: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const isCashierOnly =
      tenantContext.roles?.includes('CASHIER') &&
      !tenantContext.roles?.includes('OWNER') &&
      !tenantContext.roles?.includes('MANAGER') &&
      !tenantContext.roles?.includes('ACCOUNTANT') &&
      !tenantContext.roles?.includes('SUPER_ADMIN_SUPPORT');

    if (isCashierOnly) {
      where.AND = [
        {
          OR: [
            // 1. Products explicitly assigned to this cashier's branch
            ...(tenantContext.outletId
              ? [{ outletAccess: { some: { outletId: tenantContext.outletId } } }]
              : []),
            // 2. Products explicitly assigned to this cashier's user ID
            ...(tenantContext.userId
              ? [{ cashierAccess: { some: { userId: tenantContext.userId } } }]
              : []),
          ],
        },
      ];
    }

    const products = await this.prisma.product.findMany({
      where,
      include: {
        outletAccess: { select: { outletId: true } },
        cashierAccess: { select: { userId: true } },
      },
      orderBy: { name: 'asc' },
    });

    return products.map((p) => ({
      ...p,
      costPrice: isCashierOnly ? 0.0 : p.costPrice,
      assignedOutletIds: p.outletAccess.map((oa) => oa.outletId),
      assignedUserIds: p.cashierAccess.map((ca) => ca.userId),
    }));
  }

  async createProduct(tenantContext: TenantContext, dto: {
    name: string;
    sku: string;
    barcode?: string;
    category?: string;
    costPrice?: number;
    sellingPrice: number;
    taxRate?: number;
    stockQty?: number;
    assignedOutletIds?: string[];
    assignedUserIds?: string[];
  }) {
    const orgId = tenantContext.organizationId;

    const hasBranchAssignment = Boolean(dto.assignedOutletIds && dto.assignedOutletIds.length > 0);
    const hasCashierAssignment = Boolean(dto.assignedUserIds && dto.assignedUserIds.length > 0);
    if (!hasBranchAssignment && !hasCashierAssignment) {
      throw new BadRequestException('Please select at least one branch or cashier for this product.');
    }

    const existing = await this.prisma.product.findUnique({
      where: {
        organizationId_sku: {
          organizationId: orgId,
          sku: dto.sku,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(`A product with SKU '${dto.sku}' already exists.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          organizationId: orgId,
          name: dto.name,
          sku: dto.sku,
          barcode: dto.barcode || null,
          category: dto.category || 'General',
          costPrice: dto.costPrice || 0.0,
          sellingPrice: dto.sellingPrice,
          taxRate: dto.taxRate ?? 5.0,
          stockQty: dto.stockQty || 0.0,
        },
      });

      if (dto.assignedOutletIds && dto.assignedOutletIds.length > 0) {
        await tx.productOutletAccess.createMany({
          data: dto.assignedOutletIds.map((outletId) => ({
            productId: product.id,
            outletId,
          })),
        });
      }

      if (dto.assignedUserIds && dto.assignedUserIds.length > 0) {
        await tx.productCashierAccess.createMany({
          data: dto.assignedUserIds.map((userId) => ({
            productId: product.id,
            userId,
          })),
        });
      }

      return {
        ...product,
        assignedOutletIds: dto.assignedOutletIds || [],
        assignedUserIds: dto.assignedUserIds || [],
      };
    }, {
      maxWait: 10_000,
      timeout: 30_000,
    });
  }

  // ---------------------------------------------------------
  // 12.1 Customers Management
  // ---------------------------------------------------------
  async getCustomers(tenantContext: TenantContext, query?: { search?: string }) {
    const orgId = tenantContext.organizationId;
    const where: any = { organizationId: orgId };
    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.customer.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async createCustomer(
    tenantContext: TenantContext,
    dto: {
      name: string;
      phone?: string;
      email?: string;
      taxNumber?: string;
      billingAddress?: string;
      creditLimit?: number;
    },
  ) {
    const orgId = tenantContext.organizationId;
    if (!dto.name) throw new BadRequestException('Customer name is required.');
    return this.prisma.customer.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        phone: dto.phone || null,
        email: dto.email || null,
        taxNumber: dto.taxNumber || null,
        billingAddress: dto.billingAddress || null,
        creditLimit: Number(dto.creditLimit || 0),
      },
    });
  }

  // ---------------------------------------------------------
  // 13. Cashier Live Dashboard Metrics
  // ---------------------------------------------------------
  async getCashierDashboard(tenantContext: TenantContext) {
    if (!tenantContext || !tenantContext.organizationId) {
      throw new BadRequestException('Organization context is required.');
    }
    const orgId = tenantContext.organizationId;
    const userId = tenantContext.userId;
    const outletId = tenantContext.outletId;

    const [activeShift, heldOrders] = await Promise.all([
      this.prisma.registerSession.findFirst({
        where: {
          organizationId: orgId,
          openedByUserId: userId,
          status: 'OPEN',
        },
        orderBy: { openedAt: 'desc' },
        include: {
          outlet: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.heldOrder.findMany({
        where: {
          organizationId: orgId,
          userId,
          status: 'HELD',
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formattedHeldOrders = heldOrders.map((h) => {
      const diffMs = Date.now() - new Date(h.createdAt).getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const timeElapsed =
        diffMins < 1
          ? 'Just now'
          : diffMins < 60
          ? `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
          : `${Math.floor(diffMins / 60)}h ${diffMins % 60}m ago`;

      return {
        id: h.id,
        holdNumber: h.holdNumber,
        customer: h.customerName,
        items: h.itemCount,
        total: h.totalAmount,
        notes: h.notes,
        orderType: h.orderType,
        tableNumber: h.tableNumber,
        time: timeElapsed,
        createdAt: h.createdAt,
      };
    });

    const heldOrdersCount = formattedHeldOrders.length;
    const heldOrdersTotal = formattedHeldOrders.reduce((sum, h) => sum + h.total, 0);

    if (!activeShift) {
      return {
        hasActiveShift: false,
        shift: null,
        shiftCashInRegister: 0.0,
        shiftDigitalAndUpi: 0.0,
        shiftTotalSales: 0.0,
        shiftSalesCount: 0,
        heldOrdersCount,
        heldOrdersTotal,
        heldOrders: formattedHeldOrders,
        message: 'Start a shift to begin billing.',
      };
    }

    // 2. Completed sales & payments during this active shift (queried in parallel)
    const [shiftInvoices, shiftPayments] = await Promise.all([
      this.prisma.saleInvoice.findMany({
        where: {
          organizationId: orgId,
          createdByUserId: userId,
          createdAt: { gte: activeShift.openedAt },
          paymentStatus: { in: ['PAID', 'PARTIALLY_PAID'] },
        },
        include: {
          payments: true,
        },
      }),
      this.prisma.payment.findMany({
        where: {
          organizationId: orgId,
          createdByUserId: userId,
          transactionDate: { gte: activeShift.openedAt },
          status: 'COMPLETED',
        },
      }),
    ]);

    const openingFloat = activeShift.openingFloat || 0.0;

    let completedCashSales = 0.0;
    let shiftDigitalAndUpi = 0.0;
    let cashRefunds = 0.0;
    let cashPaidOut = activeShift.cashPaidOut || 0.0;

    for (const p of shiftPayments) {
      const method = (p.paymentMethod || '').toUpperCase();
      const isCash = method === 'CASH';
      const isRefund = p.type === 'REFUND';

      if (isCash) {
        if (isRefund) {
          cashRefunds += p.amount;
        } else {
          completedCashSales += p.amount;
        }
      } else {
        if (!isRefund) {
          shiftDigitalAndUpi += p.amount;
        }
      }
    }

    // Fallback if payments table had no explicit rows but invoices were paid
    if (shiftPayments.length === 0 && shiftInvoices.length > 0) {
      for (const inv of shiftInvoices) {
        completedCashSales += inv.paidAmount;
      }
    }

    const shiftCashInRegister = Math.max(
      0,
      openingFloat + completedCashSales - cashRefunds - cashPaidOut,
    );
    const shiftTotalSales = completedCashSales + shiftDigitalAndUpi;
    const shiftSalesCount = shiftInvoices.length;

    // 4. Cashier-specific Quotations, Invoices, and Receipts stats & recent records
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [
      myTotalQuotationsCount,
      myAcceptedQuotationsCount,
      myTotalInvoicesCount,
      myPaidInvoicesCount,
      myUnpaidInvoicesCount,
      myTotalReceiptsCount,
      myAllReceipts,
      recentQuotations,
      recentInvoices,
      recentReceipts,
    ] = await Promise.all([
      this.prisma.quotation.count({
        where: { organizationId: orgId, createdByUserId: userId },
      }),
      this.prisma.quotation.count({
        where: { organizationId: orgId, createdByUserId: userId, status: 'ACCEPTED' },
      }),
      this.prisma.saleInvoice.count({
        where: { organizationId: orgId, createdByUserId: userId },
      }),
      this.prisma.saleInvoice.count({
        where: { organizationId: orgId, createdByUserId: userId, paymentStatus: 'PAID' },
      }),
      this.prisma.saleInvoice.count({
        where: {
          organizationId: orgId,
          createdByUserId: userId,
          paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
      }),
      this.prisma.receipt.count({
        where: { organizationId: orgId, createdByUserId: userId, status: { not: 'VOIDED' } },
      }),
      this.prisma.receipt.findMany({
        where: { organizationId: orgId, createdByUserId: userId, status: { not: 'VOIDED' } },
        select: { amountPaid: true, paymentDate: true },
      }),
      this.prisma.quotation.findMany({
        where: { organizationId: orgId, createdByUserId: userId },
        include: { customer: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.saleInvoice.findMany({
        where: { organizationId: orgId, createdByUserId: userId },
        include: { customer: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.receipt.findMany({
        where: { organizationId: orgId, createdByUserId: userId },
        include: { customer: true, invoice: { select: { invoiceNumber: true } } },
        orderBy: { paymentDate: 'desc' },
        take: 5,
      }),
    ]);

    const myTotalCollection = myAllReceipts.reduce((sum, r) => sum + r.amountPaid, 0);
    const myTodayCollection = myAllReceipts
      .filter((r) => r.paymentDate >= todayStart && r.paymentDate <= todayEnd)
      .reduce((sum, r) => sum + r.amountPaid, 0);

    return {
      hasActiveShift: true,
      shift: {
        id: activeShift.id,
        registerId: activeShift.registerId,
        outletId: activeShift.outletId,
        outletName: activeShift.outlet?.name,
        openedAt: activeShift.openedAt,
        openingFloat: activeShift.openingFloat,
        status: activeShift.status,
      },
      shiftCashInRegister,
      shiftDigitalAndUpi,
      shiftTotalSales,
      shiftSalesCount,
      heldOrdersCount,
      heldOrdersTotal,
      heldOrders: formattedHeldOrders,
      myTotalQuotationsCount,
      myAcceptedQuotationsCount,
      myTotalInvoicesCount,
      myPaidInvoicesCount,
      myUnpaidInvoicesCount,
      myTotalReceiptsCount,
      myTotalCollection,
      myTodayCollection,
      recentQuotations,
      recentInvoices,
      recentReceipts,
      message: null,
    };
  }

  // ---------------------------------------------------------
  // 14. Shift / Register Sessions
  // ---------------------------------------------------------
  async getCurrentShift(tenantContext: TenantContext) {
    const orgId = tenantContext.organizationId;
    const userId = tenantContext.userId;

    const activeShift = await this.prisma.registerSession.findFirst({
      where: {
        organizationId: orgId,
        openedByUserId: userId,
        status: 'OPEN',
      },
      orderBy: { openedAt: 'desc' },
      include: {
        outlet: { select: { id: true, name: true, code: true } },
      },
    });

    return activeShift;
  }

  async openShift(
    tenantContext: TenantContext,
    dto: { openingFloat?: number; openingCash?: number; registerId?: string },
    currentUserId?: string,
  ) {
    const orgId = tenantContext.organizationId;
    const userId = currentUserId || tenantContext.userId;
    const outletId = tenantContext.outletId;

    if (!outletId) {
      throw new BadRequestException('Branch / Outlet context is required to start a shift.');
    }

    const floatVal = dto.openingCash !== undefined ? dto.openingCash : (dto.openingFloat !== undefined ? dto.openingFloat : 0.0);
    const openingFloat = Number(floatVal);
    if (isNaN(openingFloat) || openingFloat < 0) {
      throw new BadRequestException('Opening cash must be a valid non-negative amount.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Verify user account is active
      const user = await tx.user.findUnique({
        where: { id: userId },
      });
      if (!user || !user.isActive) {
        throw new ForbiddenException('Your account is inactive. Contact the owner.');
      }

      // Verify outlet belongs to org and is active
      const outlet = await tx.outlet.findFirst({
        where: { id: outletId, organizationId: orgId, isActive: true },
      });
      if (!outlet) {
        throw new BadRequestException('No active branch is assigned to this cashier.');
      }

      const existingOpen = await tx.registerSession.findFirst({
        where: {
          organizationId: orgId,
          openedByUserId: userId,
          status: 'OPEN',
        },
        orderBy: { openedAt: 'desc' },
        include: {
          outlet: { select: { id: true, name: true, code: true } },
        },
      });

      if (existingOpen) {
        return existingOpen;
      }

      let registerId = dto.registerId;
      if (!registerId) {
        let reg = await tx.register.findFirst({
          where: { outletId, isActive: true },
        });
        if (!reg) {
          reg = await tx.register.create({
            data: {
              outletId,
              code: 'REG-01',
              name: 'Main Counter Register',
              isActive: true,
            },
          });
        }
        registerId = reg.id;
      }

      const shift = await tx.registerSession.create({
        data: {
          organizationId: orgId,
          outletId,
          registerId,
          openedByUserId: userId,
          openingFloat,
          cashSales: 0.0,
          cashReceipts: 0.0,
          cashRefunds: 0.0,
          cashPaidOut: 0.0,
          expectedClosingCash: openingFloat,
          status: 'OPEN',
          openedAt: new Date(),
        },
        include: {
          outlet: { select: { id: true, name: true, code: true } },
        },
      });

      return shift;
    }, {
      maxWait: 10_000,
      timeout: 30_000,
    });
  }

  async closeShift(
    tenantContext: TenantContext,
    dto: { actualClosingCash?: number; notes?: string },
    currentUserId?: string,
  ) {
    const orgId = tenantContext.organizationId;
    const userId = currentUserId || tenantContext.userId;

    const activeShift = await this.prisma.registerSession.findFirst({
      where: {
        organizationId: orgId,
        openedByUserId: userId,
        status: 'OPEN',
      },
      orderBy: { openedAt: 'desc' },
    });

    if (!activeShift) {
      throw new NotFoundException('No active shift found to close.');
    }

    // Calculate actual cash sales
    const shiftCashPayments = await this.prisma.payment.findMany({
      where: {
        organizationId: orgId,
        createdByUserId: userId,
        transactionDate: { gte: activeShift.openedAt },
        paymentMethod: 'CASH',
        status: 'COMPLETED',
      },
    });

    const cashSales = shiftCashPayments
      .filter((p) => p.type !== 'REFUND')
      .reduce((sum, p) => sum + p.amount, 0);

    const cashRefunds = shiftCashPayments
      .filter((p) => p.type === 'REFUND')
      .reduce((sum, p) => sum + p.amount, 0);

    const expectedClosingCash =
      activeShift.openingFloat + cashSales - cashRefunds - (activeShift.cashPaidOut || 0);

    const actualClosingCash =
      dto.actualClosingCash !== undefined ? Number(dto.actualClosingCash) : expectedClosingCash;
    const cashDifference = actualClosingCash - expectedClosingCash;

    const closed = await this.prisma.registerSession.update({
      where: { id: activeShift.id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedByUserId: userId,
        cashSales,
        cashRefunds,
        expectedClosingCash,
        actualClosingCash,
        cashDifference,
      },
    });

    return closed;
  }

  // ---------------------------------------------------------
  // 15. Held Orders Management
  // ---------------------------------------------------------
  async getHeldOrders(tenantContext: TenantContext) {
    const orgId = tenantContext.organizationId;
    const userId = tenantContext.userId;

    return this.prisma.heldOrder.findMany({
      where: {
        organizationId: orgId,
        userId,
        status: 'HELD',
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createHeldOrder(tenantContext: TenantContext, dto: any, currentUserId?: string) {
    const orgId = tenantContext.organizationId;
    const userId = currentUserId || tenantContext.userId;
    const outletId = dto.outletId || tenantContext.outletId;

    if (!outletId) {
      throw new BadRequestException('Outlet context is required to hold an order.');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Cannot hold an empty cart.');
    }

    const activeShift = await this.prisma.registerSession.findFirst({
      where: {
        organizationId: orgId,
        openedByUserId: userId,
        status: 'OPEN',
      },
      orderBy: { openedAt: 'desc' },
    });

    const count = await this.prisma.heldOrder.count({
      where: { organizationId: orgId },
    });
    const holdNumber = `HELD-${String(count + 1).padStart(3, '0')}`;

    const items = dto.items || [];
    const subtotal = items.reduce(
      (acc: number, item: any) => acc + (Number(item.price || item.unitPrice || 0) * Number(item.qty || item.quantity || 1)),
      0,
    );
    const discountPercent = Number(dto.discountPercent || 0);
    const discountAmount = (subtotal * discountPercent) / 100;
    const totalAmount = Number(dto.total || dto.totalAmount || Math.max(0, subtotal - discountAmount));

    const heldOrder = await this.prisma.heldOrder.create({
      data: {
        holdNumber,
        organizationId: orgId,
        outletId,
        userId,
        registerSessionId: activeShift?.id || null,
        customerName: dto.customerName || 'Walk-in Customer',
        notes: dto.notes || 'Parked Bill',
        orderType: dto.orderType || 'RETAIL',
        tableNumber: dto.tableNumber || null,
        itemsJson: JSON.stringify(items),
        itemCount: items.length,
        subtotal,
        discountPercent,
        discountAmount,
        taxAmount: 0.0,
        totalAmount,
        status: 'HELD',
      },
    });

    return heldOrder;
  }

  async restoreHeldOrder(tenantContext: TenantContext, id: string, currentUserId?: string) {
    const orgId = tenantContext.organizationId;
    const userId = currentUserId || tenantContext.userId;

    const heldOrder = await this.prisma.heldOrder.findFirst({
      where: {
        id,
        organizationId: orgId,
        userId,
        status: 'HELD',
      },
    });

    if (!heldOrder) {
      throw new NotFoundException('Held order not found or already restored.');
    }

    await this.prisma.heldOrder.update({
      where: { id },
      data: { status: 'RESTORED' },
    });

    let parsedItems = [];
    try {
      parsedItems = JSON.parse(heldOrder.itemsJson);
    } catch {
      parsedItems = [];
    }

    return {
      ...heldOrder,
      items: parsedItems,
    };
  }

  async cancelHeldOrder(tenantContext: TenantContext, id: string, currentUserId?: string) {
    const orgId = tenantContext.organizationId;
    const userId = currentUserId || tenantContext.userId;

    const heldOrder = await this.prisma.heldOrder.findFirst({
      where: {
        id,
        organizationId: orgId,
        userId,
      },
    });

    if (!heldOrder) {
      throw new NotFoundException('Held order not found.');
    }

    await this.prisma.heldOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return {
      success: true,
      message: `Held order ${heldOrder.holdNumber} has been cancelled.`,
    };
  }
}



