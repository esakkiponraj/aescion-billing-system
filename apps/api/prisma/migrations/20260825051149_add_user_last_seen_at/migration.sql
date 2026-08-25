-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "loyaltyPointsBalance" DOUBLE PRECISION NOT NULL DEFAULT 0.0;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "registerSessionId" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "isService" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "loyaltyPoints" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "minOrderQty" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'UNIT';

-- AlterTable
ALTER TABLE "register_sessions" ADD COLUMN     "closingNotes" TEXT;

-- AlterTable
ALTER TABLE "sale_invoices" ADD COLUMN     "additionalCharges" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "loyaltyPointsEarned" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "loyaltyPointsRedeemed" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "orderType" TEXT NOT NULL DEFAULT 'RETAIL',
ADD COLUMN     "quotationId" TEXT,
ADD COLUMN     "registerSessionId" TEXT,
ADD COLUMN     "termsAndConditions" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "product_outlet_access" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_outlet_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_cashier_access" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_cashier_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "held_orders" (
    "id" TEXT NOT NULL,
    "holdNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "registerSessionId" TEXT,
    "customerName" TEXT NOT NULL DEFAULT 'Walk-in Customer',
    "notes" TEXT,
    "orderType" TEXT NOT NULL DEFAULT 'RETAIL',
    "tableNumber" TEXT,
    "itemsJson" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 1,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "status" TEXT NOT NULL DEFAULT 'HELD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "held_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "customerId" TEXT,
    "quotationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "taxableAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "cgstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "sgstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "igstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "additionalCharges" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "termsAndConditions" TEXT,
    "notes" TEXT,
    "cancelReason" TEXT,
    "convertedInvoiceId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "taxableAmount" DOUBLE PRECISION NOT NULL,
    "cgst" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "sgst" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "igst" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "productName" TEXT,
    "sku" TEXT,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentId" TEXT,
    "customerId" TEXT,
    "amountPaid" DOUBLE PRECISION NOT NULL,
    "previouslyPaid" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "remainingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "referenceNumber" TEXT,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "notes" TEXT,
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_counters" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_outlet_access_productId_idx" ON "product_outlet_access"("productId");

-- CreateIndex
CREATE INDEX "product_outlet_access_outletId_idx" ON "product_outlet_access"("outletId");

-- CreateIndex
CREATE UNIQUE INDEX "product_outlet_access_productId_outletId_key" ON "product_outlet_access"("productId", "outletId");

-- CreateIndex
CREATE INDEX "product_cashier_access_productId_idx" ON "product_cashier_access"("productId");

-- CreateIndex
CREATE INDEX "product_cashier_access_userId_idx" ON "product_cashier_access"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "product_cashier_access_productId_userId_key" ON "product_cashier_access"("productId", "userId");

-- CreateIndex
CREATE INDEX "held_orders_organizationId_outletId_idx" ON "held_orders"("organizationId", "outletId");

-- CreateIndex
CREATE INDEX "held_orders_userId_status_idx" ON "held_orders"("userId", "status");

-- CreateIndex
CREATE INDEX "held_orders_registerSessionId_idx" ON "held_orders"("registerSessionId");

-- CreateIndex
CREATE INDEX "quotations_organizationId_outletId_idx" ON "quotations"("organizationId", "outletId");

-- CreateIndex
CREATE INDEX "quotations_organizationId_createdAt_idx" ON "quotations"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "quotations_status_idx" ON "quotations"("status");

-- CreateIndex
CREATE INDEX "quotations_createdByUserId_idx" ON "quotations"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_organizationId_quotationNumber_key" ON "quotations"("organizationId", "quotationNumber");

-- CreateIndex
CREATE INDEX "quotation_items_quotationId_idx" ON "quotation_items"("quotationId");

-- CreateIndex
CREATE INDEX "receipts_organizationId_outletId_idx" ON "receipts"("organizationId", "outletId");

-- CreateIndex
CREATE INDEX "receipts_organizationId_paymentDate_idx" ON "receipts"("organizationId", "paymentDate");

-- CreateIndex
CREATE INDEX "receipts_invoiceId_idx" ON "receipts"("invoiceId");

-- CreateIndex
CREATE INDEX "receipts_status_idx" ON "receipts"("status");

-- CreateIndex
CREATE INDEX "receipts_createdByUserId_idx" ON "receipts"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_organizationId_receiptNumber_key" ON "receipts"("organizationId", "receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "document_counters_organizationId_type_year_key" ON "document_counters"("organizationId", "type", "year");

-- CreateIndex
CREATE INDEX "payments_registerSessionId_idx" ON "payments"("registerSessionId");

-- CreateIndex
CREATE INDEX "register_sessions_openedByUserId_status_idx" ON "register_sessions"("openedByUserId", "status");

-- CreateIndex
CREATE INDEX "sale_invoices_registerSessionId_idx" ON "sale_invoices"("registerSessionId");

-- AddForeignKey
ALTER TABLE "sale_invoices" ADD CONSTRAINT "sale_invoices_registerSessionId_fkey" FOREIGN KEY ("registerSessionId") REFERENCES "register_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_invoices" ADD CONSTRAINT "sale_invoices_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_invoices" ADD CONSTRAINT "sale_invoices_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_registerSessionId_fkey" FOREIGN KEY ("registerSessionId") REFERENCES "register_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_outlet_access" ADD CONSTRAINT "product_outlet_access_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_outlet_access" ADD CONSTRAINT "product_outlet_access_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_cashier_access" ADD CONSTRAINT "product_cashier_access_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_cashier_access" ADD CONSTRAINT "product_cashier_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "held_orders" ADD CONSTRAINT "held_orders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "held_orders" ADD CONSTRAINT "held_orders_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "held_orders" ADD CONSTRAINT "held_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "held_orders" ADD CONSTRAINT "held_orders_registerSessionId_fkey" FOREIGN KEY ("registerSessionId") REFERENCES "register_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_convertedInvoiceId_fkey" FOREIGN KEY ("convertedInvoiceId") REFERENCES "sale_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "sale_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_counters" ADD CONSTRAINT "document_counters_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
