// Business & Platform Enums
export enum BusinessType {
  RETAIL = 'RETAIL',
  SUPERMARKET = 'SUPERMARKET',
  WHOLESALE = 'WHOLESALE',
  RESTAURANT = 'RESTAURANT',
  SERVICE = 'SERVICE',
  PHARMACY = 'PHARMACY',
}

export enum OrganizationStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_ONBOARDING = 'PENDING_ONBOARDING',
  DEACTIVATED = 'DEACTIVATED',
}

export enum MembershipStatus {
  ACTIVE = 'ACTIVE',
  INVITED = 'INVITED',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATED = 'DEACTIVATED',
}

export enum PermissionScope {
  OWN = 'OWN',
  OUTLET = 'OUTLET',
  MULTI_OUTLET = 'MULTI_OUTLET',
  ORGANIZATION = 'ORGANIZATION',
}

export enum SystemRoleCode {
  SUPER_ADMIN = 'SUPER_ADMIN',
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  CASHIER = 'CASHIER',
  ACCOUNTANT = 'ACCOUNTANT',
  CUSTOM = 'CUSTOM',
}

export enum ApprovalType {
  EXCESSIVE_DISCOUNT = 'EXCESSIVE_DISCOUNT',
  PRICE_OVERRIDE = 'PRICE_OVERRIDE',
  SALE_REFUND = 'SALE_REFUND',
  INVOICE_CANCEL = 'INVOICE_CANCEL',
  STOCK_ADJUSTMENT = 'STOCK_ADJUSTMENT',
  PURCHASE_APPROVAL = 'PURCHASE_APPROVAL',
  CREDIT_LIMIT_OVERRIDE = 'CREDIT_LIMIT_OVERRIDE',
  CASH_WITHDRAWAL = 'CASH_WITHDRAWAL',
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum SubscriptionStatus {
  TRIALING = 'TRIALING',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELLED = 'CANCELLED',
}

// Granular Permission Constants
export const Permissions = {
  // Tenancy & Organization
  ORG_READ: 'org.read',
  ORG_UPDATE: 'org.update',
  OUTLET_MANAGE: 'outlet.manage',
  REGISTER_MANAGE: 'register.manage',

  // IAM & Roles
  EMPLOYEES_READ: 'employees.read',
  EMPLOYEES_MANAGE: 'employees.manage',
  ROLES_READ: 'roles.read',
  ROLES_MANAGE: 'roles.manage',

  // Sales & POS
  SALES_CREATE: 'sales.create',
  SALES_READ: 'sales.read',
  SALES_REFUND: 'sales.refund',
  SALES_CANCEL: 'sales.cancel',
  SALES_DISCOUNT: 'sales.discount',
  SALES_PRICE_OVERRIDE: 'sales.price_override',

  // Inventory
  INVENTORY_READ: 'inventory.read',
  INVENTORY_ADJUST: 'inventory.adjust',
  INVENTORY_TRANSFER: 'inventory.transfer',

  // Purchases
  PURCHASE_READ: 'purchase.read',
  PURCHASE_CREATE: 'purchase.create',
  PURCHASE_APPROVE: 'purchase.approve',

  // Financials & Accounting
  EXPENSES_MANAGE: 'expenses.manage',
  TAXES_MANAGE: 'taxes.manage',
  REPORTS_SALES_READ: 'reports.sales.read',
  REPORTS_PROFIT_READ: 'reports.profit.read',
  AUDIT_READ: 'audit.read',

  // Dedicated Finance & Accounting Permissions
  FINANCE_DASHBOARD_READ: 'finance.dashboard.read',
  SALES_INVOICE_READ: 'sales.invoice.read',
  SALES_INVOICE_EXPORT: 'sales.invoice.export',
  PURCHASE_BILL_READ: 'purchase.bill.read',
  PURCHASE_BILL_EXPORT: 'purchase.bill.export',
  PAYMENT_READ: 'payment.read',
  PAYMENT_CREATE: 'payment.create',
  RECEIVABLE_READ: 'receivable.read',
  PAYABLE_READ: 'payable.read',
  EXPENSE_READ: 'expense.read',
  EXPENSE_CREATE: 'expense.create',
  EXPENSE_UPDATE: 'expense.update',
  CASH_READ: 'cash.read',
  BANK_READ: 'bank.read',
  LEDGER_READ: 'ledger.read',
  TAX_READ: 'tax.read',
  TAX_EXPORT: 'tax.export',
  FINANCIAL_REPORT_READ: 'financial_report.read',
  FINANCIAL_REPORT_EXPORT: 'financial_report.export',

  // Product Management (RBAC & Field-Level Authorization)
  PRODUCTS_READ: 'products.read',
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_UPDATE: 'products.update',
  PRODUCTS_PRICE_UPDATE: 'products.price_update',
  PRODUCTS_STOCK_UPDATE: 'products.stock_update',
  PRODUCTS_DELETE: 'products.delete',

  // Categories & Catalog
  CATEGORIES_READ: 'categories.read',
  CATEGORIES_MANAGE: 'categories.manage',

  // Customers
  CUSTOMERS_READ: 'customers.read',
  CUSTOMERS_MANAGE: 'customers.manage',

  // Dashboard
  DASHBOARD_READ: 'dashboard.read',

  // Approvals
  APPROVALS_READ: 'approvals.read',
  APPROVALS_DECIDE: 'approvals.decide',

  // Quotations
  QUOTATIONS_READ: 'quotations.read',
  QUOTATIONS_CREATE: 'quotations.create',
  QUOTATIONS_UPDATE: 'quotations.update',
  QUOTATIONS_CONVERT: 'quotations.convert',
  QUOTATIONS_CANCEL: 'quotations.cancel',

  // Receipts
  RECEIPTS_READ: 'receipts.read',
  RECEIPTS_VOID: 'receipts.void',
} as const;

export type PermissionCode = (typeof Permissions)[keyof typeof Permissions];

export enum QuotationStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  CONVERTED = 'CONVERTED',
  CANCELLED = 'CANCELLED',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  UNPAID = 'UNPAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export enum ReceiptStatus {
  ISSUED = 'ISSUED',
  VOIDED = 'VOIDED',
}

export enum DocumentPaymentMethod {
  CASH = 'CASH',
  UPI = 'UPI',
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CHEQUE = 'CHEQUE',
  OTHER = 'OTHER',
  CREDIT = 'CREDIT',
}

// User & Auth Interfaces
export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  isSuperAdmin: boolean;
  isActive: boolean;
}

export interface TenantContext {
  userId: string;
  organizationId: string;
  organizationName: string;
  outletId: string;
  outletName: string;
  legalEntityId?: string;
  roles: string[];
  permissions: {
    code: PermissionCode;
    scope: PermissionScope;
  }[];
  authorityLimits: {
    maxDiscountPercent: number;
    canOverridePrice: boolean;
    approvalLimit: number;
  };
  isSupportImpersonation?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthSessionResponse {
  user: AuthenticatedUser;
  tokens?: AuthTokens;
  organizations: UserOrganizationSummary[];
  activeTenantContext?: TenantContext;
}

export interface UserOrganizationSummary {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  businessType: BusinessType;
  roleCode: string;
  roleName: string;
  outlets: {
    outletId: string;
    outletName: string;
    outletCode: string;
  }[];
}

// Onboarding DTOs
export interface OnboardingPayload {
  businessName: string;
  businessType: BusinessType;
  country: string;
  currency: string;
  timezone: string;
  businessSize: 'JUST_ME' | '2-10' | '11-50' | '50+';
  outletCount: number;
  taxIdentifier?: string;
  defaultTaxRate?: number;
  enabledModules: string[];
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerEmail?: string;
  ownerPassword?: string;
  ownerPhone?: string;
}

// Approval DTOs
export interface CreateApprovalRequestDto {
  outletId: string;
  approvalType: ApprovalType;
  resourceType: string;
  resourceId?: string;
  requestedValue: string;
  reason: string;
}

export interface ResolveApprovalRequestDto {
  status: ApprovalStatus.APPROVED | ApprovalStatus.REJECTED;
  comments?: string;
}

// API Standard Responses
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

// Business Industry Capabilities
export interface BusinessTypeCapability {
  businessType: BusinessType;
  label: string;
  category: 'RETAIL_COMMERCE' | 'HOSPITALITY' | 'SERVICES' | 'HEALTHCARE';
  enabledModules: {
    dashboard: boolean;
    pos: boolean;
    products: boolean;
    services: boolean;
    inventory: boolean;
    quotations: boolean;
    workOrders: boolean;
    tablesAndOrders: boolean;
    kitchenKOT: boolean;
    purchases: boolean;
    suppliers: boolean;
    customers: boolean;
    invoices: boolean;
    payments: boolean;
    expenses: boolean;
    reports: boolean;
    team: boolean;
    roles: boolean;
    branches: boolean;
  };
  posMode: 'FAST_BILLING' | 'TABLE_SERVICE' | 'DIRECT_BILLING' | 'WHOLESALE_ORDER' | 'NONE';
  inventoryMode: 'BARCODE_RETAIL' | 'BATCH_EXPIRY' | 'BULK_WHOLESALE' | 'INGREDIENTS' | 'NONE';
  terminology: {
    itemLabel: string;
    itemPluralLabel: string;
    catalogAction: string;
    posAction: string;
    orderLabel: string;
    customerLabel: string;
    emptyCatalogText: string;
  };
  dashboardCapabilities: {
    showFastBillingAction: boolean;
    showLowStockWidget: boolean;
    showBatchExpiryWidget: boolean;
    showTableStatusWidget: boolean;
    showWorkOrdersWidget: boolean;
    showBulkOrdersWidget: boolean;
    showTopProductsWidget: boolean;
    metricsLabels: {
      primaryMetric: string;
      secondaryMetric: string;
    };
  };
}

export const BUSINESS_TYPE_CAPABILITIES: Record<BusinessType, BusinessTypeCapability> = {
  [BusinessType.SUPERMARKET]: {
    businessType: BusinessType.SUPERMARKET,
    label: 'Supermarket / Grocery',
    category: 'RETAIL_COMMERCE',
    enabledModules: {
      dashboard: true,
      pos: true,
      products: true,
      services: false,
      inventory: true,
      quotations: false,
      workOrders: false,
      tablesAndOrders: false,
      kitchenKOT: false,
      purchases: true,
      suppliers: true,
      customers: true,
      invoices: true,
      payments: true,
      expenses: true,
      reports: true,
      team: true,
      roles: true,
      branches: true,
    },
    posMode: 'FAST_BILLING',
    inventoryMode: 'BARCODE_RETAIL',
    terminology: {
      itemLabel: 'Product',
      itemPluralLabel: 'Products & Stock',
      catalogAction: 'Add Product',
      posAction: 'Fast Billing (POS)',
      orderLabel: 'Sales Invoice',
      customerLabel: 'Customer',
      emptyCatalogText: 'No supermarket items in catalog yet. Add your first product to begin.',
    },
    dashboardCapabilities: {
      showFastBillingAction: true,
      showLowStockWidget: true,
      showBatchExpiryWidget: false,
      showTableStatusWidget: false,
      showWorkOrdersWidget: false,
      showBulkOrdersWidget: false,
      showTopProductsWidget: true,
      metricsLabels: {
        primaryMetric: "Today's Gross Sales",
        secondaryMetric: "Active POS Registers",
      },
    },
  },
  [BusinessType.RETAIL]: {
    businessType: BusinessType.RETAIL,
    label: 'Retail Shop',
    category: 'RETAIL_COMMERCE',
    enabledModules: {
      dashboard: true,
      pos: true,
      products: true,
      services: false,
      inventory: true,
      quotations: false,
      workOrders: false,
      tablesAndOrders: false,
      kitchenKOT: false,
      purchases: true,
      suppliers: true,
      customers: true,
      invoices: true,
      payments: true,
      expenses: true,
      reports: true,
      team: true,
      roles: true,
      branches: true,
    },
    posMode: 'FAST_BILLING',
    inventoryMode: 'BARCODE_RETAIL',
    terminology: {
      itemLabel: 'Product',
      itemPluralLabel: 'Retail Catalog',
      catalogAction: 'Add Product',
      posAction: 'Retail POS',
      orderLabel: 'Receipt / Bill',
      customerLabel: 'Customer',
      emptyCatalogText: 'No products in your catalog yet. Create your first retail product.',
    },
    dashboardCapabilities: {
      showFastBillingAction: true,
      showLowStockWidget: true,
      showBatchExpiryWidget: false,
      showTableStatusWidget: false,
      showWorkOrdersWidget: false,
      showBulkOrdersWidget: false,
      showTopProductsWidget: true,
      metricsLabels: {
        primaryMetric: "Today's Store Sales",
        secondaryMetric: "Active Counters",
      },
    },
  },
  [BusinessType.WHOLESALE]: {
    businessType: BusinessType.WHOLESALE,
    label: 'Wholesale / Distribution',
    category: 'RETAIL_COMMERCE',
    enabledModules: {
      dashboard: true,
      pos: false,
      products: true,
      services: false,
      inventory: true,
      quotations: true,
      workOrders: false,
      tablesAndOrders: false,
      kitchenKOT: false,
      purchases: true,
      suppliers: true,
      customers: true,
      invoices: true,
      payments: true,
      expenses: true,
      reports: true,
      team: true,
      roles: true,
      branches: true,
    },
    posMode: 'WHOLESALE_ORDER',
    inventoryMode: 'BULK_WHOLESALE',
    terminology: {
      itemLabel: 'Wholesale SKU',
      itemPluralLabel: 'Inventory & Lots',
      catalogAction: 'Add Product Lot',
      posAction: 'Bulk Billing',
      orderLabel: 'Sales Order / Invoice',
      customerLabel: 'Wholesale Account',
      emptyCatalogText: 'No wholesale lots registered. Add inventory items to start trading.',
    },
    dashboardCapabilities: {
      showFastBillingAction: false,
      showLowStockWidget: true,
      showBatchExpiryWidget: false,
      showTableStatusWidget: false,
      showWorkOrdersWidget: false,
      showBulkOrdersWidget: true,
      showTopProductsWidget: true,
      metricsLabels: {
        primaryMetric: "Billed Distribution Revenue",
        secondaryMetric: "Pending Dispatches",
      },
    },
  },
  [BusinessType.RESTAURANT]: {
    businessType: BusinessType.RESTAURANT,
    label: 'Restaurant / Cafe / Food Service',
    category: 'HOSPITALITY',
    enabledModules: {
      dashboard: true,
      pos: true,
      products: true,
      services: false,
      inventory: true,
      quotations: false,
      workOrders: false,
      tablesAndOrders: true,
      kitchenKOT: true,
      purchases: true,
      suppliers: true,
      customers: true,
      invoices: true,
      payments: true,
      expenses: true,
      reports: true,
      team: true,
      roles: true,
      branches: true,
    },
    posMode: 'TABLE_SERVICE',
    inventoryMode: 'INGREDIENTS',
    terminology: {
      itemLabel: 'Menu Item',
      itemPluralLabel: 'Menu & Recipes',
      catalogAction: 'Add Menu Item',
      posAction: 'Table & Order POS',
      orderLabel: 'Food Order / KOT',
      customerLabel: 'Diner / Table',
      emptyCatalogText: 'No menu items configured. Add your first beverage or dish.',
    },
    dashboardCapabilities: {
      showFastBillingAction: true,
      showLowStockWidget: false,
      showBatchExpiryWidget: false,
      showTableStatusWidget: true,
      showWorkOrdersWidget: false,
      showBulkOrdersWidget: false,
      showTopProductsWidget: true,
      metricsLabels: {
        primaryMetric: "Today's F&B Revenue",
        secondaryMetric: "Active Dining Tables",
      },
    },
  },
  [BusinessType.SERVICE]: {
    businessType: BusinessType.SERVICE,
    label: 'Service / Repair Business',
    category: 'SERVICES',
    enabledModules: {
      dashboard: true,
      pos: false,
      products: false,
      services: true,
      inventory: false,
      quotations: true,
      workOrders: true,
      tablesAndOrders: false,
      kitchenKOT: false,
      purchases: false,
      suppliers: false,
      customers: true,
      invoices: true,
      payments: true,
      expenses: true,
      reports: true,
      team: true,
      roles: true,
      branches: true,
    },
    posMode: 'NONE',
    inventoryMode: 'NONE',
    terminology: {
      itemLabel: 'Service Offering',
      itemPluralLabel: 'Services & Rates',
      catalogAction: 'Add Service',
      posAction: 'Service Billing',
      orderLabel: 'Job Ticket / Work Order',
      customerLabel: 'Client',
      emptyCatalogText: 'No services defined yet. Create your first service offering or hourly rate.',
    },
    dashboardCapabilities: {
      showFastBillingAction: false,
      showLowStockWidget: false,
      showBatchExpiryWidget: false,
      showTableStatusWidget: false,
      showWorkOrdersWidget: true,
      showBulkOrdersWidget: false,
      showTopProductsWidget: false,
      metricsLabels: {
        primaryMetric: "Today's Service Revenue",
        secondaryMetric: "Active Work Orders",
      },
    },
  },
  [BusinessType.PHARMACY]: {
    businessType: BusinessType.PHARMACY,
    label: 'Pharmacy / Healthcare Retail',
    category: 'HEALTHCARE',
    enabledModules: {
      dashboard: true,
      pos: true,
      products: true,
      services: false,
      inventory: true,
      quotations: false,
      workOrders: false,
      tablesAndOrders: false,
      kitchenKOT: false,
      purchases: true,
      suppliers: true,
      customers: true,
      invoices: true,
      payments: true,
      expenses: true,
      reports: true,
      team: true,
      roles: true,
      branches: true,
    },
    posMode: 'FAST_BILLING',
    inventoryMode: 'BATCH_EXPIRY',
    terminology: {
      itemLabel: 'Medicine',
      itemPluralLabel: 'Medicines & Batches',
      catalogAction: 'Add Medicine',
      posAction: 'Pharmacy Counter POS',
      orderLabel: 'Prescription Bill',
      customerLabel: 'Patient / Customer',
      emptyCatalogText: 'No medicines in stock. Add your first medicine with batch and expiry tracking.',
    },
    dashboardCapabilities: {
      showFastBillingAction: true,
      showLowStockWidget: true,
      showBatchExpiryWidget: true,
      showTableStatusWidget: false,
      showWorkOrdersWidget: false,
      showBulkOrdersWidget: false,
      showTopProductsWidget: true,
      metricsLabels: {
        primaryMetric: "Today's Pharmacy Sales",
        secondaryMetric: "Active Dispense Counters",
      },
    },
  },
};

export function getBusinessTypeCapability(
  businessType: BusinessType | string | null | undefined,
): BusinessTypeCapability {
  if (!businessType) {
    return BUSINESS_TYPE_CAPABILITIES[BusinessType.RETAIL];
  }
  const normalized = businessType.toUpperCase() as BusinessType;
  return BUSINESS_TYPE_CAPABILITIES[normalized] || BUSINESS_TYPE_CAPABILITIES[BusinessType.RETAIL];
}

