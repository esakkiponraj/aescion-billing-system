# Engineering Development Roadmap

```
PHASE 0: ARCHITECTURE & BLUEPRINT ─── [ COMPLETED ]
├── Architecture documents & module map
├── Database relational schema & ER design
└── Multi-tenancy, RBAC & Offline strategy

PHASE 1: SAAS FOUNDATION ─── [ ACTIVE ]
├── Monorepo setup (apps/api, apps/web, packages/types)
├── Prisma multi-tenant data model & seed data
├── Auth (JWT, rotating refresh tokens, session tracking)
├── Context interceptors (Org & Outlet validation)
├── Granular RBAC, scope resolution & approval limits
├── 6-step progressive onboarding wizard
├── Role-aware frontend shells (Owner/Pulse, Manager, Cashier, Accountant)
├── Context switchers & team/role management
└── Tenant isolation & RBAC automated tests

PHASE 2: MASTER DATA & CATALOG
├── Products, SKUs, Variants, Barcodes, Units, Categories, Brands
├── Tax engine (Configurable rules, GSTIN/VAT, HSN/SAC)
└── Customers (360 view, loyalty, credit) & Suppliers

PHASE 3: POS & BILLING ENGINE
├── Fast POS checkout interface, barcode scan & split tender
├── Hold / resume bills, returns, refunds & receipt printing
└── Cash register shift opening, cash in/out, day-end reconciliation

PHASE 4: INVENTORY LEDGER & PURCHASES
├── Event-sourced stock_movements ledger & batch/expiry tracking
├── Purchase orders, Goods Received Notes (GRN), Supplier invoices
└── Inter-branch stock transfers & adjustments

PHASE 5: OPERATIONS & FINANCIALS
├── Generic approval workflow engine
├── Expenses & petty cash
└── Customer & supplier outstanding ledgers

PHASE 6: ANALYTICS & BUSINESS PULSE
├── Real-time exception detector (Business Pulse)
├── Sales, margin, velocity, cashier discrepancy analytics
└── Export engine (Excel / PDF)

PHASE 7: RESTAURANT PACK
├── Floor plans, tables, KOT, kitchen stations
└── Recipe-based ingredient deduction & modifier groups

PHASE 8: OFFLINE & HARDWARE INTEGRATION
├── IndexedDB sync engine & offline invoice sequencing
└── Thermal printer, barcode scanner & cash drawer abstraction
```
