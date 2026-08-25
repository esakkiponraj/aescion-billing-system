-- CreateIndex
CREATE INDEX IF NOT EXISTS "products_organizationId_category_idx" ON "products"("organizationId", "category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "products_organizationId_stockQty_idx" ON "products"("organizationId", "stockQty");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sale_invoices_organizationId_outletId_createdAt_idx" ON "sale_invoices"("organizationId", "outletId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sale_invoices_organizationId_paymentStatus_createdAt_idx" ON "sale_invoices"("organizationId", "paymentStatus", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sale_invoices_organizationId_createdByUserId_createdAt_idx" ON "sale_invoices"("organizationId", "createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sale_invoices_organizationId_customerId_createdAt_idx" ON "sale_invoices"("organizationId", "customerId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_bills_organizationId_outletId_purchaseDate_idx" ON "purchase_bills"("organizationId", "outletId", "purchaseDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_bills_organizationId_paymentStatus_purchaseDate_idx" ON "purchase_bills"("organizationId", "paymentStatus", "purchaseDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "expenses_organizationId_outletId_expenseDate_idx" ON "expenses"("organizationId", "outletId", "expenseDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "expenses_organizationId_status_expenseDate_idx" ON "expenses"("organizationId", "status", "expenseDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quotations_organizationId_outletId_createdAt_idx" ON "quotations"("organizationId", "outletId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quotations_organizationId_status_createdAt_idx" ON "quotations"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quotations_organizationId_createdByUserId_createdAt_idx" ON "quotations"("organizationId", "createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "receipts_organizationId_outletId_paymentDate_idx" ON "receipts"("organizationId", "outletId", "paymentDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "receipts_organizationId_paymentMethod_paymentDate_idx" ON "receipts"("organizationId", "paymentMethod", "paymentDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "receipts_organizationId_status_paymentDate_idx" ON "receipts"("organizationId", "status", "paymentDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "receipts_organizationId_createdByUserId_paymentDate_idx" ON "receipts"("organizationId", "createdByUserId", "paymentDate");
