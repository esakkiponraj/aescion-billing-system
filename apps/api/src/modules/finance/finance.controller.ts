import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permissions, TenantContext } from '@aescion/types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('dashboard')
  @RequirePermissions(Permissions.REPORTS_SALES_READ)
  async getDashboard(
    @CurrentTenant() tenant: TenantContext,
    @Query('outletId') outletId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financeService.getDashboardSummary(tenant, { outletId, startDate, endDate });
  }

  @Get('sales-invoices')
  @RequirePermissions(Permissions.SALES_READ)
  async getSalesInvoices(
    @CurrentTenant() tenant: TenantContext,
    @Query('search') search?: string,
    @Query('outletId') outletId?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('customerId') customerId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financeService.getSalesInvoices(tenant, {
      search,
      outletId,
      paymentStatus,
      customerId,
      startDate,
      endDate,
    });
  }

  @Get('sales-invoices/:id')
  @RequirePermissions(Permissions.SALES_READ)
  async getSalesInvoiceDetail(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.financeService.getSalesInvoiceDetail(tenant, id);
  }

  @Post('sales-invoices')
  @RequirePermissions(Permissions.SALES_CREATE)
  async createSalesInvoice(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser('id') currentUserId: string,
    @Body() dto: any,
  ) {
    return this.financeService.createSalesInvoice(tenant, dto, currentUserId);
  }

  @Get('purchase-bills')
  @RequirePermissions(Permissions.PURCHASE_READ)
  async getPurchaseBills(
    @CurrentTenant() tenant: TenantContext,
    @Query('search') search?: string,
    @Query('outletId') outletId?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('supplierId') supplierId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financeService.getPurchaseBills(tenant, {
      search,
      outletId,
      paymentStatus,
      supplierId,
      startDate,
      endDate,
    });
  }

  @Get('purchase-bills/:id')
  @RequirePermissions(Permissions.PURCHASE_READ)
  async getPurchaseBillDetail(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.financeService.getPurchaseBillDetail(tenant, id);
  }

  @Get('payments')
  @RequirePermissions(Permissions.REPORTS_SALES_READ)
  async getPayments(
    @CurrentTenant() tenant: TenantContext,
    @Query('type') type?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('outletId') outletId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financeService.getPayments(tenant, {
      type,
      paymentMethod,
      outletId,
      startDate,
      endDate,
    });
  }

  @Post('payments')
  @RequirePermissions(Permissions.EXPENSES_MANAGE)
  async createPayment(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: {
      type: 'CUSTOMER_RECEIPT' | 'SUPPLIER_PAYMENT' | 'REFUND';
      customerId?: string;
      supplierId?: string;
      invoiceId?: string;
      purchaseBillId?: string;
      amount: number;
      paymentMethod: string;
      referenceNumber?: string;
      notes?: string;
    },
  ) {
    return this.financeService.createPayment(tenant, dto);
  }

  @Get('receivables')
  @RequirePermissions(Permissions.REPORTS_SALES_READ)
  async getReceivables(
    @CurrentTenant() tenant: TenantContext,
    @Query('outletId') outletId?: string,
  ) {
    return this.financeService.getAccountsReceivable(tenant, { outletId });
  }

  @Get('payables')
  @RequirePermissions(Permissions.REPORTS_SALES_READ)
  async getPayables(
    @CurrentTenant() tenant: TenantContext,
    @Query('outletId') outletId?: string,
  ) {
    return this.financeService.getAccountsPayable(tenant, { outletId });
  }

  @Get('expenses')
  @RequirePermissions(Permissions.EXPENSES_MANAGE)
  async getExpenses(
    @CurrentTenant() tenant: TenantContext,
    @Query('category') category?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('outletId') outletId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financeService.getExpenses(tenant, {
      category,
      paymentMethod,
      outletId,
      startDate,
      endDate,
    });
  }

  @Post('expenses')
  @RequirePermissions(Permissions.EXPENSES_MANAGE)
  async createExpense(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: {
      category: string;
      description: string;
      amount: number;
      taxAmount?: number;
      paymentMethod: string;
      expenseDate?: string;
      vendorName?: string;
      referenceNumber?: string;
    },
  ) {
    return this.financeService.createExpense(tenant, dto);
  }

  @Get('cash-bank')
  @RequirePermissions(Permissions.REPORTS_SALES_READ)
  async getCashBank(
    @CurrentTenant() tenant: TenantContext,
    @Query('outletId') outletId?: string,
  ) {
    return this.financeService.getCashBankActivity(tenant, { outletId });
  }

  @Get('ledgers')
  @RequirePermissions(Permissions.REPORTS_SALES_READ)
  async getLedgers(
    @CurrentTenant() tenant: TenantContext,
    @Query('ledgerType') ledgerType?: 'sales' | 'purchase' | 'expense' | 'customer' | 'supplier' | 'cash' | 'bank',
    @Query('entityId') entityId?: string,
    @Query('outletId') outletId?: string,
  ) {
    return this.financeService.getLedgers(tenant, { ledgerType, entityId, outletId });
  }

  @Get('tax-summary')
  @RequirePermissions(Permissions.TAXES_MANAGE)
  async getTaxSummary(
    @CurrentTenant() tenant: TenantContext,
    @Query('outletId') outletId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financeService.getTaxSummary(tenant, { outletId, startDate, endDate });
  }

  @Get('reports')
  @RequirePermissions(Permissions.REPORTS_SALES_READ)
  async getReports(
    @CurrentTenant() tenant: TenantContext,
    @Query('reportType') reportType?: string,
    @Query('outletId') outletId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financeService.getFinancialReports(tenant, { reportType, outletId, startDate, endDate });
  }

  @Get('products')
  @RequirePermissions(Permissions.SALES_READ)
  async getProducts(
    @CurrentTenant() tenant: TenantContext,
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    return this.financeService.getProducts(tenant, { search, category });
  }

  @Post('products')
  @RequirePermissions(Permissions.SALES_CREATE)
  async createProduct(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: {
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
    },
  ) {
    return this.financeService.createProduct(tenant, dto);
  }

  @Get('cashier-dashboard')
  @RequirePermissions(Permissions.SALES_READ)
  async getCashierDashboard(@CurrentTenant() tenant: TenantContext) {
    return this.financeService.getCashierDashboard(tenant);
  }

  @Get('shifts/current')
  @RequirePermissions(Permissions.SALES_READ)
  async getCurrentShift(@CurrentTenant() tenant: TenantContext) {
    return this.financeService.getCurrentShift(tenant);
  }

  @Post('shifts/open')
  @RequirePermissions(Permissions.SALES_READ)
  async openShift(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser('id') currentUserId: string,
    @Body() dto: { openingFloat?: number; openingCash?: number; registerId?: string },
  ) {
    return this.financeService.openShift(tenant, dto, currentUserId);
  }

  @Post('shifts/start')
  @RequirePermissions(Permissions.SALES_READ)
  async startShift(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser('id') currentUserId: string,
    @Body() dto: { openingFloat?: number; openingCash?: number; registerId?: string },
  ) {
    return this.financeService.openShift(tenant, dto, currentUserId);
  }

  @Post('shifts/close')
  @RequirePermissions(Permissions.SALES_READ)
  async closeShift(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser('id') currentUserId: string,
    @Body() dto: { actualClosingCash?: number; notes?: string },
  ) {
    return this.financeService.closeShift(tenant, dto, currentUserId);
  }

  @Get('held-orders')
  @RequirePermissions(Permissions.SALES_READ)
  async getHeldOrders(@CurrentTenant() tenant: TenantContext) {
    return this.financeService.getHeldOrders(tenant);
  }

  @Post('held-orders')
  @RequirePermissions(Permissions.SALES_CREATE)
  async createHeldOrder(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser('id') currentUserId: string,
    @Body() dto: any,
  ) {
    return this.financeService.createHeldOrder(tenant, dto, currentUserId);
  }

  @Put('held-orders/:id/restore')
  @RequirePermissions(Permissions.SALES_READ)
  async restoreHeldOrder(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser('id') currentUserId: string,
    @Param('id') id: string,
  ) {
    return this.financeService.restoreHeldOrder(tenant, id, currentUserId);
  }

  @Delete('held-orders/:id')
  @RequirePermissions(Permissions.SALES_READ)
  async cancelHeldOrder(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser('id') currentUserId: string,
    @Param('id') id: string,
  ) {
    return this.financeService.cancelHeldOrder(tenant, id, currentUserId);
  }
}
