export const SYSTEM_PERMISSIONS = [
  // Dashboard Module
  { code: 'dashboard.read', module: 'dashboard', description: 'View business pulse, sales charts, and owner KPI widgets' },
  { code: 'finance.dashboard.read', module: 'dashboard', description: 'View financial health dashboard and cash position' },

  // Products Module
  { code: 'products.read', module: 'products', description: 'View products catalog, SKU details, and pricing' },
  { code: 'products.create', module: 'products', description: 'Create new product catalog entries' },
  { code: 'products.update', module: 'products', description: 'Update product information, categories, and barcodes' },
  { code: 'products.price_update', module: 'products', description: 'Modify selling prices, cost prices, and margins' },
  { code: 'products.stock_update', module: 'products', description: 'Modify opening inventory and stock count levels' },
  { code: 'products.delete', module: 'products', description: 'Delete or archive product catalog entries' },

  // Categories Module
  { code: 'categories.read', module: 'categories', description: 'View product category listings' },
  { code: 'categories.manage', module: 'categories', description: 'Create, edit, and organize product categories' },

  // Inventory/Stock Module
  { code: 'inventory.read', module: 'inventory', description: 'View branch stock levels, batches, and reorder alerts' },
  { code: 'inventory.adjust', module: 'inventory', description: 'Perform manual stock adjustments and audits' },
  { code: 'inventory.transfer', module: 'inventory', description: 'Initiate and receive inter-branch inventory transfers' },

  // Billing/POS Module
  { code: 'pos.access', module: 'billing_pos', description: 'Access POS terminal register and cashier workspace' },
  { code: 'sales.create', module: 'billing_pos', description: 'Generate new sales orders and fast POS bills' },
  { code: 'sales.read', module: 'billing_pos', description: 'View current register transactions and cart bills' },
  { code: 'sales.cancel', module: 'billing_pos', description: 'Void or cancel active and pending orders' },

  // Invoices Module
  { code: 'sales.invoice.read', module: 'invoices', description: 'View finalized tax sales invoices' },
  { code: 'sales.invoice.export', module: 'invoices', description: 'Export sales invoices and tax invoices to CSV/PDF' },

  // Customers Module
  { code: 'customers.read', module: 'customers', description: 'View customer directories, ledgers, and credit limits' },
  { code: 'customers.manage', module: 'customers', description: 'Create, edit, and manage customer credit profiles' },

  // Sales Module
  { code: 'sales.view', module: 'sales', description: 'View historical sales records and invoice receipts' },

  // Returns Module
  { code: 'sales.refund', module: 'returns', description: 'Process item returns and credit note refunds' },

  // Discounts Module
  { code: 'sales.discount', module: 'discounts', description: 'Apply manual line-item and invoice discounts' },
  { code: 'sales.price_override', module: 'discounts', description: 'Override default selling price during checkout' },

  // Reports Module
  { code: 'reports.sales.read', module: 'reports', description: 'View sales velocity, revenue metrics, and branch trends' },
  { code: 'reports.profit.read', module: 'reports', description: 'View gross profit margins and COGS breakdown' },
  { code: 'financial_report.read', module: 'reports', description: 'View P&L balance summaries and tax reports' },
  { code: 'financial_report.export', module: 'reports', description: 'Export financial and tax compliance reports' },

  // Branches Module
  { code: 'outlet.manage', module: 'branches', description: 'Create and configure physical branch outlets and tax settings' },
  { code: 'register.manage', module: 'branches', description: 'Create and assign billing counters and POS registers' },

  // Team & Access Module
  { code: 'employees.read', module: 'team_access', description: 'View team members, cashier roster, and account status' },
  { code: 'employees.manage', module: 'team_access', description: 'Invite, edit, activate, deactivate, and assign team members' },

  // Roles & Permissions Module
  { code: 'roles.read', module: 'roles_permissions', description: 'View defined role sets and permission policies' },
  { code: 'roles.manage', module: 'roles_permissions', description: 'Create, edit, and delete custom access roles' },

  // Settings Module
  { code: 'org.read', module: 'settings', description: 'View business profile and tax settings' },
  { code: 'org.update', module: 'settings', description: 'Update organization legal entity and business profile' },
  { code: 'taxes.manage', module: 'settings', description: 'Configure tax GST slabs and compliance codes' },
  { code: 'expenses.manage', module: 'settings', description: 'Record, edit, and track operational expenses' },
  { code: 'audit.read', module: 'settings', description: 'View immutable system security audit logs' },

  // Purchases & Payables
  { code: 'purchase.read', module: 'purchases', description: 'View supplier purchase bills and vendor orders' },
  { code: 'purchase.create', module: 'purchases', description: 'Create purchase orders and receive vendor inventory' },
  { code: 'purchase.approve', module: 'purchases', description: 'Approve vendor purchase bills above limits' },
  { code: 'purchase.bill.read', module: 'purchases', description: 'View detailed supplier purchase bills' },
  { code: 'purchase.bill.export', module: 'purchases', description: 'Export vendor bills and ledger aging' },

  // Payments & Cash Position
  { code: 'payment.read', module: 'finance', description: 'View payment transactions and receipts' },
  { code: 'payment.create', module: 'finance', description: 'Record customer receipt or supplier payment' },
  { code: 'receivable.read', module: 'finance', description: 'View customer accounts receivable and credit aging' },
  { code: 'payable.read', module: 'finance', description: 'View supplier accounts payable and credit aging' },
  { code: 'expense.read', module: 'finance', description: 'View operational expenses ledger' },
  { code: 'expense.create', module: 'finance', description: 'Record new business expense' },
  { code: 'expense.update', module: 'finance', description: 'Update or categorize expense entry' },
  { code: 'cash.read', module: 'finance', description: 'View cash register float and cash movements' },
  { code: 'bank.read', module: 'finance', description: 'View bank account movements and digital payments' },
  { code: 'ledger.read', module: 'finance', description: 'View customer, supplier, and financial sub-ledgers' },
  { code: 'tax.read', module: 'finance', description: 'View Output and Input GST summaries' },
  { code: 'tax.export', module: 'finance', description: 'Export GST and tax returns' },

  // Approvals Module
  { code: 'approvals.read', module: 'approvals', description: 'View pending discount and price override approval requests' },
  { code: 'approvals.decide', module: 'approvals', description: 'Approve or reject cashier exception requests' },
];

