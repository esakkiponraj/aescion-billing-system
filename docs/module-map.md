# AESCION System Module Map

```
┌────────────────────────────────────────────────────────────────────────────┐
│                             AESCION SAAS MODULES                           │
├────────────────────────────────────────────────────────────────────────────┤
│ 1. AUTHENTICATION & IAM                                                    │
│    - Session management, JWT, Refresh Token rotation, Device fingerprint   │
│    - User accounts, Invitations, Password resets                           │
│    - Dynamic Roles, Granular Permissions (domain.action), Authority limits │
│                                                                            │
│ 2. TENANCY & REGIONAL SETUP                                                │
│    - Organization (Tenant Root), Multi-Tenant Isolation                    │
│    - Legal Entities (Tax/GSTIN/VAT registries)                             │
│    - Outlets / Branches, Registers / Cash Drawers                          │
│    - Context Switcher (Org & Outlet)                                       │
│                                                                            │
│ 3. MASTER DATA                                                             │
│    - Products (Goods & Services), SKU, Barcodes, Categories, Brands        │
│    - Unit Conversions, Dynamic Variants (Size/Color/Pack)                  │
│    - Price Lists (Retail, Wholesale, Special), Tax Codes & Rates           │
│    - Customers (360 view, loyalty, credit limit), Suppliers               │
│                                                                            │
│ 4. COMMERCE & POS                                                          │
│    - High-velocity billing screen, Barcode scanning, Search                │
│    - Split / Multi-tender payments (Cash, UPI QR, Card, Credit)           │
│    - Held bills, Partial payments, Invoices, Returns & Refunds             │
│    - Register Sessions (Open shift, Cash In/Out, Day End Recon)            │
│                                                                            │
│ 5. INVENTORY & PURCHASING                                                  │
│    - Event-sourced Stock Ledger (stock_movements)                          │
│    - Batches, Serial numbers, Expiry dates                                 │
│    - Purchase Orders, Goods Received Notes (GRN), Supplier Invoices        │
│    - Stock Transfers (Inter-outlet), Stock Adjustments & Damage write-offs │
│                                                                            │
│ 6. OPERATIONS & APPROVALS                                                  │
│    - Generic Approval Engine (Discounts, Refunds, Credit limits)           │
│    - Expense tracking & Petty cash                                         │
│    - Loyalty points engine & customer balance management                   │
│    - In-app & webhook notifications                                        │
│                                                                            │
│ 7. ANALYTICS & BUSINESS PULSE                                              │
│    - Real-time exception detector (Business Pulse alerts)                  │
│    - Sales, Margin, Fast/Dead stock analytics                              │
│    - Cashier performance & Audit discrepancy reports                       │
│    - PDF & Excel export pipelines                                          │
│                                                                            │
│ 8. RESTAURANT PACK (Phase 7 Module)                                        │
│    - Floor plans & Table management                                        │
│    - Kitchen Display System (KDS), Kitchen Order Tickets (KOT)             │
│    - Modifiers, Recipe-based ingredient deduction                          │
│                                                                            │
│ 9. SUPER ADMIN & SAAS OPERATIONS                                           │
│    - Multi-tenant directory, Subscription tiers, Feature flags             │
│    - Support Mode (Authorized, time-limited tenant impersonation)          │
│    - Global audit logs and platform health                                 │
└────────────────────────────────────────────────────────────────────────────┘
```
