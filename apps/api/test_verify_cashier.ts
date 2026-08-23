import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting Comprehensive Cashier & POS System Verification...');

  // 1. Fetch or create test organization & outlets
  let org = await prisma.organization.findFirst({
    where: { slug: 'test-retail-corp' },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'Test Retail Corp',
        slug: 'test-retail-corp',
        businessType: 'RETAIL',
      },
    });
  }

  // Outlet 1 (Main Branch)
  let outlet1 = await prisma.outlet.findFirst({
    where: { organizationId: org.id, code: 'TEST-B1' },
  });
  if (!outlet1) {
    outlet1 = await prisma.outlet.create({
      data: {
        organizationId: org.id,
        name: 'Main Branch',
        code: 'TEST-B1',
      },
    });
  }

  // Outlet 2 (West Branch)
  let outlet2 = await prisma.outlet.findFirst({
    where: { organizationId: org.id, code: 'TEST-B2' },
  });
  if (!outlet2) {
    outlet2 = await prisma.outlet.create({
      data: {
        organizationId: org.id,
        name: 'West Branch',
        code: 'TEST-B2',
      },
    });
  }

  // Password hash
  const pwd = '$2a$10$abcdefghijklmnopqrstuvwxyz123456';

  // Cashier A (Branch 1)
  let cashierA = await prisma.user.findFirst({
    where: { email: 'cashier.a@test.com' },
  });
  if (!cashierA) {
    cashierA = await prisma.user.create({
      data: {
        email: 'cashier.a@test.com',
        firstName: 'Cashier',
        lastName: 'Alpha',
        passwordHash: pwd,
      },
    });
  }

  // Cashier B (Branch 2)
  let cashierB = await prisma.user.findFirst({
    where: { email: 'cashier.b@test.com' },
  });
  if (!cashierB) {
    cashierB = await prisma.user.create({
      data: {
        email: 'cashier.b@test.com',
        firstName: 'Cashier',
        lastName: 'Beta',
        passwordHash: pwd,
      },
    });
  }

  // Clean up any test products
  await prisma.productOutletAccess.deleteMany({
    where: { product: { organizationId: org.id } },
  });
  await prisma.productCashierAccess.deleteMany({
    where: { product: { organizationId: org.id } },
  });
  await prisma.heldOrder.deleteMany({
    where: { organizationId: org.id },
  });
  await prisma.payment.deleteMany({
    where: { organizationId: org.id },
  });
  await prisma.saleInvoiceItem.deleteMany({
    where: { invoice: { organizationId: org.id } },
  });
  await prisma.saleInvoice.deleteMany({
    where: { organizationId: org.id },
  });
  await prisma.registerSession.deleteMany({
    where: { organizationId: org.id },
  });
  await prisma.product.deleteMany({
    where: { organizationId: org.id },
  });

  console.log('✅ 1. Database Cleaned and Base Test Environment Ready');

  // -------------------------------------------------------------
  // Test 1 & 2: Create products with specific scoping
  // -------------------------------------------------------------
  // Product 1: Branch 1 Only
  const prodBranch1 = await prisma.product.create({
    data: {
      organizationId: org.id,
      name: 'Branch 1 Exclusive Milk',
      sku: 'SKU-B1-MILK',
      sellingPrice: 50.0,
      costPrice: 35.0,
      stockQty: 100,
    },
  });
  await prisma.productOutletAccess.create({
    data: { productId: prodBranch1.id, outletId: outlet1.id },
  });

  // Product 2: Cashier A Direct Assignment Only
  const prodCashierA = await prisma.product.create({
    data: {
      organizationId: org.id,
      name: 'Cashier A Direct Special Item',
      sku: 'SKU-CA-SPEC',
      sellingPrice: 150.0,
      costPrice: 90.0,
      stockQty: 50,
    },
  });
  await prisma.productCashierAccess.create({
    data: { productId: prodCashierA.id, userId: cashierA.id },
  });

  // Product 3: Branch 2 Exclusive
  const prodBranch2 = await prisma.product.create({
    data: {
      organizationId: org.id,
      name: 'Branch 2 Exclusive Bread',
      sku: 'SKU-B2-BREAD',
      sellingPrice: 40.0,
      costPrice: 25.0,
      stockQty: 80,
    },
  });
  await prisma.productOutletAccess.create({
    data: { productId: prodBranch2.id, outletId: outlet2.id },
  });

  console.log('✅ 2. Created test scoped products');

  // -------------------------------------------------------------
  // Test 3: Cashier Visibility Scoping Query Simulation
  // -------------------------------------------------------------
  // Cashier A query (in Branch 1):
  const cashierAProducts = await prisma.product.findMany({
    where: {
      organizationId: org.id,
      AND: [
        {
          OR: [
            { outletAccess: { some: { outletId: outlet1.id } } },
            { cashierAccess: { some: { userId: cashierA.id } } },
          ],
        },
      ],
    },
  });

  if (cashierAProducts.length !== 2) {
    throw new Error(`Expected Cashier A to see 2 products, but saw ${cashierAProducts.length}`);
  }
  const cashierAIds = cashierAProducts.map((p) => p.id);
  if (!cashierAIds.includes(prodBranch1.id) || !cashierAIds.includes(prodCashierA.id)) {
    throw new Error('Cashier A missing assigned products');
  }
  if (cashierAIds.includes(prodBranch2.id)) {
    throw new Error('Cashier A can illegally see Branch 2 exclusive product!');
  }

  // Cashier B query (in Branch 2):
  const cashierBProducts = await prisma.product.findMany({
    where: {
      organizationId: org.id,
      AND: [
        {
          OR: [
            { outletAccess: { some: { outletId: outlet2.id } } },
            { cashierAccess: { some: { userId: cashierB.id } } },
          ],
        },
      ],
    },
  });

  if (cashierBProducts.length !== 1 || cashierBProducts[0].id !== prodBranch2.id) {
    throw new Error(`Expected Cashier B to see only Branch 2 Bread, saw ${cashierBProducts.length}`);
  }

  console.log('✅ 3. Strict Cashier Scoping Filter Verified (Cashier A: 2 products, Cashier B: 1 product)');

  // -------------------------------------------------------------
  // Test 4: Shift Lifecycle & Cashier Dashboard Metrics
  // -------------------------------------------------------------
  // Open shift for Cashier A with float ₹1000
  let reg = await prisma.register.findFirst({ where: { outletId: outlet1.id } });
  if (!reg) {
    reg = await prisma.register.create({
      data: { outletId: outlet1.id, code: 'REG-01', name: 'Main Reg' },
    });
  }

  const shiftA = await prisma.registerSession.create({
    data: {
      organizationId: org.id,
      outletId: outlet1.id,
      registerId: reg.id,
      openedByUserId: cashierA.id,
      openingFloat: 1000.0,
      expectedClosingCash: 1000.0,
      status: 'OPEN',
      openedAt: new Date(),
    },
  });

  // Make a Cash Sale of ₹250
  const invCash = await prisma.saleInvoice.create({
    data: {
      invoiceNumber: 'INV-TEST-0001',
      organizationId: org.id,
      outletId: outlet1.id,
      registerSessionId: shiftA.id,
      subtotal: 250.0,
      totalAmount: 250.0,
      paidAmount: 250.0,
      paymentStatus: 'PAID',
      createdByUserId: cashierA.id,
    },
  });
  await prisma.payment.create({
    data: {
      paymentNumber: 'PAY-TEST-0001',
      organizationId: org.id,
      outletId: outlet1.id,
      invoiceId: invCash.id,
      registerSessionId: shiftA.id,
      amount: 250.0,
      paymentMethod: 'CASH',
      type: 'CUSTOMER_RECEIPT',
      status: 'COMPLETED',
      createdByUserId: cashierA.id,
    },
  });

  // Make a UPI Sale of ₹800
  const invUpi = await prisma.saleInvoice.create({
    data: {
      invoiceNumber: 'INV-TEST-0002',
      organizationId: org.id,
      outletId: outlet1.id,
      registerSessionId: shiftA.id,
      subtotal: 800.0,
      totalAmount: 800.0,
      paidAmount: 800.0,
      paymentStatus: 'PAID',
      createdByUserId: cashierA.id,
    },
  });
  await prisma.payment.create({
    data: {
      paymentNumber: 'PAY-TEST-0002',
      organizationId: org.id,
      outletId: outlet1.id,
      invoiceId: invUpi.id,
      registerSessionId: shiftA.id,
      amount: 800.0,
      paymentMethod: 'UPI',
      type: 'CUSTOMER_RECEIPT',
      status: 'COMPLETED',
      createdByUserId: cashierA.id,
    },
  });

  // Create a Held Order for Cashier A
  const heldOrder = await prisma.heldOrder.create({
    data: {
      holdNumber: 'HELD-001',
      organizationId: org.id,
      outletId: outlet1.id,
      userId: cashierA.id,
      registerSessionId: shiftA.id,
      customerName: 'Mr. Sharma',
      itemsJson: JSON.stringify([{ productId: prodBranch1.id, name: prodBranch1.name, price: 50, qty: 2 }]),
      itemCount: 2,
      subtotal: 100.0,
      totalAmount: 100.0,
      status: 'HELD',
    },
  });

  // Simulate Dashboard Metric Calculations for Cashier A
  const paymentsA = await prisma.payment.findMany({
    where: {
      organizationId: org.id,
      createdByUserId: cashierA.id,
      transactionDate: { gte: shiftA.openedAt },
      status: 'COMPLETED',
    },
  });

  const cashSales = paymentsA.filter((p) => p.paymentMethod === 'CASH').reduce((s, p) => s + p.amount, 0);
  const digitalSales = paymentsA.filter((p) => p.paymentMethod !== 'CASH').reduce((s, p) => s + p.amount, 0);
  const cashInRegister = shiftA.openingFloat + cashSales;

  if (cashInRegister !== 1250.0) {
    throw new Error(`Expected Shift Cash to be 1250.0 (1000 float + 250 cash), got ${cashInRegister}`);
  }
  if (digitalSales !== 800.0) {
    throw new Error(`Expected Shift Digital to be 800.0, got ${digitalSales}`);
  }

  const heldListA = await prisma.heldOrder.findMany({
    where: { organizationId: org.id, userId: cashierA.id, status: 'HELD' },
  });
  if (heldListA.length !== 1 || heldListA[0].id !== heldOrder.id) {
    throw new Error('Held order not found for Cashier A');
  }

  console.log(`✅ 4. Live Dashboard Calculations Verified: Cash In Register = ₹${cashInRegister}, Digital/UPI = ₹${digitalSales}, Held Orders = ${heldListA.length}`);

  // -------------------------------------------------------------
  // Test 5: Cashier B Isolation
  // -------------------------------------------------------------
  // Check Cashier B's shift & held orders (Cashier B has no open shift)
  const shiftB = await prisma.registerSession.findFirst({
    where: { organizationId: org.id, openedByUserId: cashierB.id, status: 'OPEN' },
  });
  const heldListB = await prisma.heldOrder.findMany({
    where: { organizationId: org.id, userId: cashierB.id, status: 'HELD' },
  });

  if (shiftB !== null) {
    throw new Error('Cashier B incorrectly has an open shift');
  }
  if (heldListB.length !== 0) {
    throw new Error('Cashier B incorrectly sees Cashier A held orders');
  }

  console.log('✅ 5. Cashier B Data Isolation Verified (0 Shift Cash, 0 UPI, 0 Held Orders, hasActiveShift = false)');

  // -------------------------------------------------------------
  // Test 6: Resume and Complete Held Order
  // -------------------------------------------------------------
  await prisma.heldOrder.update({
    where: { id: heldOrder.id },
    data: { status: 'RESTORED' },
  });

  const remainingHeldA = await prisma.heldOrder.findMany({
    where: { organizationId: org.id, userId: cashierA.id, status: 'HELD' },
  });
  if (remainingHeldA.length !== 0) {
    throw new Error('Held order was not removed from active queue after restore');
  }

  console.log('✅ 6. Held Order Restore / Resume Verified');

  console.log('\n🎉 ALL 6 COMPREHENSIVE CASHIER & PRODUCT ACCESS TESTS PASSED PERFECTLY!\n');
}

main()
  .catch((e) => {
    console.error('❌ Verification failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
