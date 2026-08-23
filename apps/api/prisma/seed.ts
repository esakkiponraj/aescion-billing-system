import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { SYSTEM_PERMISSIONS } from '../src/common/constants/permissions.constant';
import { SystemRoleCode } from '@aescion/types';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting AESCION Database Seeding...');

  // 1. Seed Permissions
  console.log('📦 Seeding System Permissions...');
  for (const perm of SYSTEM_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { description: perm.description, module: perm.module },
      create: {
        code: perm.code,
        module: perm.module,
        description: perm.description,
      },
    });
  }
  const allDbPermissions = await prisma.permission.findMany();

  // 2. Seed Features & Plans
  console.log('💎 Seeding Platform Features and Subscription Plans...');
  const featuresList = [
    { code: 'POS', name: 'High-Velocity POS Billing', module: 'sales' },
    { code: 'INVENTORY', name: 'Inventory & Stock Ledger', module: 'inventory' },
    { code: 'MULTI_OUTLET', name: 'Multi-Branch Management', module: 'tenancy' },
    { code: 'ADVANCED_ANALYTICS', name: 'Business Pulse & Analytics', module: 'analytics' },
    { code: 'RESTAURANT_PACK', name: 'Restaurant KOT & Tables', module: 'restaurant' },
  ];

  const featureEntities: any = {};
  for (const f of featuresList) {
    featureEntities[f.code] = await prisma.feature.upsert({
      where: { code: f.code },
      update: { name: f.name, module: f.module },
      create: { code: f.code, name: f.name, module: f.module },
    });
  }

  const plans = [
    {
      code: 'STARTER',
      name: 'Starter Single-Shop',
      description: 'Ideal for independent single-counter shops and retailers',
      maxOutlets: 1,
      maxUsers: 3,
      maxRegisters: 1,
    },
    {
      code: 'GROWTH',
      name: 'Growth Multi-Branch',
      description: 'Built for growing multi-outlet retail chains and supermarkets',
      maxOutlets: 5,
      maxUsers: 15,
      maxRegisters: 10,
    },
    {
      code: 'ENTERPRISE',
      name: 'Enterprise Commerce',
      description: 'Unlimited scale, custom roles, and priority support',
      maxOutlets: 50,
      maxUsers: 200,
      maxRegisters: 100,
    },
  ];

  const planEntities: any = {};
  for (const p of plans) {
    const plan = await prisma.plan.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        description: p.description,
        maxOutlets: p.maxOutlets,
        maxUsers: p.maxUsers,
        maxRegisters: p.maxRegisters,
      },
      create: p,
    });
    planEntities[p.code] = plan;

    // Attach features to plans
    for (const f of featuresList) {
      if (p.code === 'STARTER' && (f.code === 'MULTI_OUTLET' || f.code === 'RESTAURANT_PACK')) {
        continue;
      }
      await prisma.planFeature.upsert({
        where: {
          planId_featureId: {
            planId: plan.id,
            featureId: featureEntities[f.code].id,
          },
        },
        update: { isEnabled: true },
        create: {
          planId: plan.id,
          featureId: featureEntities[f.code].id,
          isEnabled: true,
        },
      });
    }
  }

  // 3. Seed Super Administrator
  console.log('🛡️ Seeding SaaS Super Administrator...');
  const superAdminPassword = await bcrypt.hash('Admin@12345', 10);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@aescion.com' },
    update: { isSuperAdmin: true },
    create: {
      email: 'admin@aescion.com',
      passwordHash: superAdminPassword,
      firstName: 'Antigravity',
      lastName: 'SuperAdmin',
      phone: '+919988776655',
      isSuperAdmin: true,
      isActive: true,
    },
  });

  // 4. Seed Multi-Outlet Tenant: "Nova Supermarket"
  console.log('🏬 Seeding Multi-Outlet Tenant: Nova Supermarket...');
  const novaOrg = await prisma.organization.upsert({
    where: { slug: 'nova-supermarket' },
    update: {},
    create: {
      name: 'Nova Supermarket',
      slug: 'nova-supermarket',
      businessType: 'SUPERMARKET',
      country: 'IN',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      status: 'ACTIVE',
    },
  });

  // Subscription for Nova Supermarket
  await prisma.subscription.upsert({
    where: { id: `sub-nova-${novaOrg.id}` },
    update: {},
    create: {
      id: `sub-nova-${novaOrg.id}`,
      organizationId: novaOrg.id,
      planId: planEntities['GROWTH'].id,
      status: 'ACTIVE',
    },
  });

  // Legal Entity
  const novaLegal = await prisma.legalEntity.upsert({
    where: { id: `le-nova-${novaOrg.id}` },
    update: {},
    create: {
      id: `le-nova-${novaOrg.id}`,
      organizationId: novaOrg.id,
      name: 'Nova Retail Pvt Ltd',
      taxNumber: '33AABCN1234F1Z5',
      registeredAddress: '77 Commerce Highway, Chennai, Tamil Nadu',
      email: 'finance@novamart.com',
      phone: '+914422334455',
    },
  });

  // Outlets: Tenkasi & Chennai
  const tenkasiOutlet = await prisma.outlet.upsert({
    where: { organizationId_code: { organizationId: novaOrg.id, code: 'TNK' } },
    update: {},
    create: {
      organizationId: novaOrg.id,
      legalEntityId: novaLegal.id,
      name: 'Tenkasi Branch',
      code: 'TNK',
      address: '42 Main Bazaar Road, Tenkasi',
      phone: '+914633221100',
    },
  });

  const chennaiOutlet = await prisma.outlet.upsert({
    where: { organizationId_code: { organizationId: novaOrg.id, code: 'CHN' } },
    update: {},
    create: {
      organizationId: novaOrg.id,
      legalEntityId: novaLegal.id,
      name: 'Chennai Flagship',
      code: 'CHN',
      address: '108 2nd Avenue, Anna Nagar, Chennai',
      phone: '+914426280011',
    },
  });

  // Registers
  const regTnk1 = await prisma.register.upsert({
    where: { outletId_code: { outletId: tenkasiOutlet.id, code: 'TNK-REG-01' } },
    update: {},
    create: {
      outletId: tenkasiOutlet.id,
      name: 'Express Lane #01',
      code: 'TNK-REG-01',
    },
  });

  const regChn1 = await prisma.register.upsert({
    where: { outletId_code: { outletId: chennaiOutlet.id, code: 'CHN-REG-01' } },
    update: {},
    create: {
      outletId: chennaiOutlet.id,
      name: 'Counter #01',
      code: 'CHN-REG-01',
    },
  });

  // Roles for Nova Supermarket
  const createOrgRole = async (
    name: string,
    code: string,
    desc: string,
    maxDiscount: number,
    priceOverride: boolean,
    approvalLimit: number,
    filterPerms: (p: any) => boolean,
    scope: string,
  ) => {
    let role = await prisma.role.findFirst({
      where: { organizationId: novaOrg.id, code },
    });
    if (!role) {
      role = await prisma.role.create({
        data: {
          organizationId: novaOrg.id,
          name,
          code,
          description: desc,
          isSystemDefault: true,
          maxDiscountPercent: maxDiscount,
          priceOverrideAllowed: priceOverride,
          approvalLimit,
        },
      });
      const perms = allDbPermissions.filter(filterPerms);
      await prisma.rolePermission.createMany({
        data: perms.map((p) => ({
          roleId: role.id,
          permissionId: p.id,
          scope,
        })),
      });
    }
    return role;
  };

  const novaOwnerRole = await createOrgRole(
    'Business Owner',
    SystemRoleCode.OWNER,
    'Full organization-wide authority',
    100.0,
    true,
    10000000.0,
    () => true,
    'ORGANIZATION',
  );

  const novaManagerRole = await createOrgRole(
    'Store Manager',
    SystemRoleCode.MANAGER,
    'Outlet operations, product management, and approval rights',
    20.0,
    true,
    50000.0,
    (p) =>
      !p.code.includes('org.update') &&
      !p.code.includes('reports.profit') &&
      p.code !== 'products.delete',
    'OUTLET',
  );

  const novaCashierRole = await createOrgRole(
    'Counter Cashier',
    SystemRoleCode.CASHIER,
    'POS terminal billing and shift management',
    5.0,
    false,
    1000.0,
    (p) => p.code.startsWith('sales.') || p.code === 'products.read',
    'OUTLET',
  );

  const novaAccountantRole = await createOrgRole(
    'Accountant',
    SystemRoleCode.ACCOUNTANT,
    'Financials, taxes, and accounting ledger exports',
    0.0,
    false,
    0.0,
    (p) =>
      p.code.includes('reports') ||
      p.code.includes('expenses') ||
      p.code.includes('taxes') ||
      p.code.includes('audit') ||
      p.code.includes('finance.') ||
      p.code.includes('.read') ||
      p.code.includes('.export') ||
      p.code === 'payment.create' ||
      p.code === 'expense.create' ||
      p.code === 'expense.update' ||
      p.code === 'products.read',
    'ORGANIZATION',
  );

  // Users for Nova Supermarket
  const createTenantUser = async (
    email: string,
    firstName: string,
    lastName: string,
    roleId: string,
    outletId?: string,
  ) => {
    const passwordHash = await bcrypt.hash('Password@123', 10);
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash,
        firstName,
        lastName,
        isActive: true,
      },
    });

    const orgMembership = await prisma.organizationMembership.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: novaOrg.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        organizationId: novaOrg.id,
        status: 'ACTIVE',
      },
    });

    let outletMembershipId: string | null = null;
    if (outletId) {
      const om = await prisma.outletMembership.upsert({
        where: {
          orgMembershipId_outletId: {
            orgMembershipId: orgMembership.id,
            outletId,
          },
        },
        update: {},
        create: {
          orgMembershipId: orgMembership.id,
          outletId,
        },
      });
      outletMembershipId = om.id;
    }

    const existingRoleMapping = await prisma.membershipRole.findFirst({
      where: { orgMembershipId: orgMembership.id, roleId },
    });

    if (!existingRoleMapping) {
      await prisma.membershipRole.create({
        data: {
          orgMembershipId: orgMembership.id,
          outletMembershipId,
          roleId,
        },
      });
    }

    return user;
  };

  const priyaOwner = await createTenantUser('priya@novamart.com', 'Priya', 'Sundaram', novaOwnerRole.id, tenkasiOutlet.id);
  const karthikManager = await createTenantUser('karthik@novamart.com', 'Karthik', 'Raja', novaManagerRole.id, tenkasiOutlet.id);
  const anandCashier = await createTenantUser('anand@novamart.com', 'Anand', 'Kumar', novaCashierRole.id, tenkasiOutlet.id);
  const sureshAccountant = await createTenantUser('suresh@novamart.com', 'Suresh', 'Raman', novaAccountantRole.id, tenkasiOutlet.id);

  // Sample Approvals for Nova Supermarket
  await prisma.approvalRequest.create({
    data: {
      organizationId: novaOrg.id,
      outletId: tenkasiOutlet.id,
      requestedByUserId: anandCashier.id,
      approvalType: 'EXCESSIVE_DISCOUNT',
      resourceType: 'SALE',
      requestedValue: '15% Discount on Bill #INV-1042',
      reason: 'Loyal customer bulk grocery purchase discount request',
      status: 'PENDING',
    },
  });

  await prisma.approvalRequest.create({
    data: {
      organizationId: novaOrg.id,
      outletId: tenkasiOutlet.id,
      requestedByUserId: anandCashier.id,
      approvalType: 'PRICE_OVERRIDE',
      resourceType: 'SALE_ITEM',
      requestedValue: '₹450 -> ₹420 (Pack of 5 Basmati Rice)',
      reason: 'Promotional flyer price match',
      status: 'APPROVED',
      decidedByUserId: karthikManager.id,
      decidedAt: new Date(),
      comments: 'Approved under weekend flyer price match policy',
    },
  });

  // 5. Seed Single-Outlet Small Business Tenant: "Apex QuickStore"
  console.log('🏪 Seeding Single-Outlet Shop: Apex QuickStore...');
  const apexOrg = await prisma.organization.upsert({
    where: { slug: 'apex-quickstore' },
    update: {},
    create: {
      name: 'Apex QuickStore',
      slug: 'apex-quickstore',
      businessType: 'RETAIL',
      country: 'IN',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      status: 'ACTIVE',
    },
  });

  await prisma.subscription.upsert({
    where: { id: `sub-apex-${apexOrg.id}` },
    update: {},
    create: {
      id: `sub-apex-${apexOrg.id}`,
      organizationId: apexOrg.id,
      planId: planEntities['STARTER'].id,
      status: 'ACTIVE',
    },
  });

  const apexLegal = await prisma.legalEntity.upsert({
    where: { id: `le-apex-${apexOrg.id}` },
    update: {},
    create: {
      id: `le-apex-${apexOrg.id}`,
      organizationId: apexOrg.id,
      name: 'Apex Quick Retailers',
      taxNumber: '33AABCA9876E1Z1',
      registeredAddress: '15 Gandhi Road, Madurai',
    },
  });

  const apexOutlet = await prisma.outlet.upsert({
    where: { organizationId_code: { organizationId: apexOrg.id, code: 'MAIN' } },
    update: {},
    create: {
      organizationId: apexOrg.id,
      legalEntityId: apexLegal.id,
      name: 'Main Store',
      code: 'MAIN',
      address: '15 Gandhi Road, Madurai',
      phone: '+914522334455',
    },
  });

  await prisma.register.upsert({
    where: { outletId_code: { outletId: apexOutlet.id, code: 'REG-01' } },
    update: {},
    create: {
      outletId: apexOutlet.id,
      name: 'Register #01',
      code: 'REG-01',
    },
  });

  let apexOwnerRole = await prisma.role.findFirst({
    where: { organizationId: apexOrg.id, code: SystemRoleCode.OWNER },
  });

  if (!apexOwnerRole) {
    apexOwnerRole = await prisma.role.create({
      data: {
        organizationId: apexOrg.id,
        name: 'Business Owner',
        code: SystemRoleCode.OWNER,
        description: 'Single-shop owner authority',
        isSystemDefault: true,
        maxDiscountPercent: 100.0,
        priceOverrideAllowed: true,
        approvalLimit: 1000000.0,
      },
    });

    await prisma.rolePermission.createMany({
      data: allDbPermissions.map((p) => ({
        roleId: apexOwnerRole!.id,
        permissionId: p.id,
        scope: 'ORGANIZATION',
      })),
    });
  }

  const rameshPassword = await bcrypt.hash('Password@123', 10);
  const rameshOwner = await prisma.user.upsert({
    where: { email: 'ramesh@apexquick.com' },
    update: {},
    create: {
      email: 'ramesh@apexquick.com',
      passwordHash: rameshPassword,
      firstName: 'Ramesh',
      lastName: 'Patel',
      isActive: true,
    },
  });

  const apexOrgMembership = await prisma.organizationMembership.upsert({
    where: {
      userId_organizationId: {
        userId: rameshOwner.id,
        organizationId: apexOrg.id,
      },
    },
    update: {},
    create: {
      userId: rameshOwner.id,
      organizationId: apexOrg.id,
      status: 'ACTIVE',
    },
  });

  const apexOutletMembership = await prisma.outletMembership.upsert({
    where: {
      orgMembershipId_outletId: {
        orgMembershipId: apexOrgMembership.id,
        outletId: apexOutlet.id,
      },
    },
    update: {},
    create: {
      orgMembershipId: apexOrgMembership.id,
      outletId: apexOutlet.id,
    },
  });

  await prisma.membershipRole.create({
    data: {
      orgMembershipId: apexOrgMembership.id,
      outletMembershipId: apexOutletMembership.id,
      roleId: apexOwnerRole.id,
    },
  });

  // 6. Seed Additional Platform Users (Internal AESCION staff)
  console.log('👥 Seeding Internal Platform Users...');
  const platformStaff = [
    { email: 'support.lead@aescion.com', firstName: 'Kavitha', lastName: 'Nair', isSuperAdmin: true },
    { email: 'agent.sarah@aescion.com', firstName: 'Sarah', lastName: 'Jenkins', isSuperAdmin: true },
    { email: 'manager.dev@aescion.com', firstName: 'Devan', lastName: 'Pillai', isSuperAdmin: true },
  ];

  for (const staff of platformStaff) {
    const staffPassword = await bcrypt.hash('Admin@12345', 10);
    await prisma.user.upsert({
      where: { email: staff.email },
      update: { isSuperAdmin: true },
      create: {
        email: staff.email,
        passwordHash: staffPassword,
        firstName: staff.firstName,
        lastName: staff.lastName,
        isSuperAdmin: true,
        isActive: true,
      },
    });
  }

  // 7. Seed Sample Support Issues
  console.log('🎫 Seeding Support Issues...');
  const supportIssuesList = [
    {
      organizationId: novaOrg.id,
      raisedByUserId: priyaOwner.id,
      category: 'PAYMENT',
      title: 'Dynamic UPI QR code latency during peak hours',
      description: 'Cashiers reported that QR code generation took 4 seconds on counter #01 during evening peak rush.',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      assignedToUserId: superAdmin.id,
      internalNotes: 'Investigating gateway latency with payment aggregator API.',
    },
    {
      organizationId: novaOrg.id,
      raisedByUserId: sureshAccountant.id,
      category: 'BILLING',
      title: 'Custom HSN tax slab configuration for regional spices',
      description: 'Need assistance setting up 12% combined SGST/CGST override for specialized unpackaged spice blends.',
      priority: 'MEDIUM',
      status: 'OPEN',
      internalNotes: 'Scheduled tax configuration walkthrough.',
    },
    {
      organizationId: apexOrg.id,
      raisedByUserId: rameshOwner.id,
      category: 'TECHNICAL',
      title: 'ESC/POS thermal printer 58mm receipt alignment',
      description: 'Receipt footer text was slightly cut off on our 58mm thermal roll.',
      priority: 'LOW',
      status: 'RESOLVED',
      assignedToUserId: superAdmin.id,
      internalNotes: 'Provided 58mm CSS narrow margin profile.',
      resolution: 'Updated thermal printing width stylesheet from 80mm to 58mm mode.',
    },
    {
      organizationId: apexOrg.id,
      raisedByUserId: rameshOwner.id,
      category: 'SUBSCRIPTION',
      title: 'Trial extension request for second billing counter testing',
      description: 'We are expanding to a second checkout lane next week and wish to trial the multi-register Growth tier.',
      priority: 'MEDIUM',
      status: 'WAITING_CLIENT',
      internalNotes: 'Approved 14-day trial extension.',
    },
  ];

  for (const issue of supportIssuesList) {
    const existing = await prisma.supportIssue.findFirst({
      where: { organizationId: issue.organizationId, title: issue.title },
    });
    if (!existing) {
      await prisma.supportIssue.create({
        data: issue,
      });
    }
  }

  // 8. Seed Platform System Settings
  console.log('⚙️ Seeding Platform System Settings...');
  const defaultSettings = [
    { key: 'platform_name', value: 'AESCION Commerce Operating System', category: 'GENERAL' },
    { key: 'default_country', value: 'IN', category: 'GENERAL' },
    { key: 'default_currency', value: 'INR', category: 'GENERAL' },
    { key: 'default_timezone', value: 'Asia/Kolkata', category: 'GENERAL' },
    { key: 'support_email', value: 'support@aescion.com', category: 'BRANDING' },
    { key: 'session_timeout_minutes', value: '60', category: 'SECURITY' },
    { key: 'support_access_max_duration', value: '120', category: 'SECURITY' },
    { key: 'trial_expiry_alert_days', value: '3', category: 'NOTIFICATIONS' },
    { key: 'critical_issue_alerts', value: 'true', category: 'NOTIFICATIONS' },
  ];

  for (const s of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value, category: s.category },
      create: s,
    });
  }

  // 9. Seed Supermarket Finance Master Data & Transactions (Nova Supermarket)
  console.log('💰 Seeding Supermarket Financial Master Data & Invoices...');
  
  // Products with actual cost prices for COGS calculations
  const productData = [
    { sku: 'MILK-01', name: 'Fresh Milk 1L Packet', category: 'Dairy', costPrice: 48.0, sellingPrice: 60.0, taxRate: 5.0, hsnCode: '0401', stockQty: 150 },
    { sku: 'BREAD-01', name: 'Whole Wheat Bread 400g', category: 'Bakery', costPrice: 32.0, sellingPrice: 45.0, taxRate: 5.0, hsnCode: '1905', stockQty: 80 },
    { sku: 'RICE-05', name: 'Basmati Rice 5kg Bag', category: 'Grocery', costPrice: 380.0, sellingPrice: 480.0, taxRate: 0.0, hsnCode: '1006', stockQty: 60 },
    { sku: 'COFF-01', name: 'Filter Coffee Powder 200g', category: 'Beverages', costPrice: 105.0, sellingPrice: 140.0, taxRate: 5.0, hsnCode: '0901', stockQty: 120 },
    { sku: 'SODA-01', name: 'Sparkling Soda 750ml', category: 'Beverages', costPrice: 26.0, sellingPrice: 40.0, taxRate: 18.0, hsnCode: '2202', stockQty: 200 },
    { sku: 'OIL-01', name: 'Refined Sunflower Oil 1L', category: 'Grocery', costPrice: 110.0, sellingPrice: 135.0, taxRate: 5.0, hsnCode: '1512', stockQty: 90 },
  ];

  const dbProducts: any = {};
  for (const p of productData) {
    dbProducts[p.sku] = await prisma.product.upsert({
      where: { organizationId_sku: { organizationId: novaOrg.id, sku: p.sku } },
      update: { costPrice: p.costPrice, sellingPrice: p.sellingPrice, stockQty: p.stockQty },
      create: { ...p, organizationId: novaOrg.id },
    });
  }

  // Customers
  const custMurugan = await prisma.customer.upsert({
    where: { id: `cust-murugan-${novaOrg.id}` },
    update: {},
    create: {
      id: `cust-murugan-${novaOrg.id}`,
      organizationId: novaOrg.id,
      name: 'Murugan Hotel & Caterers',
      phone: '+919842112233',
      email: 'accounts@muruganhotel.com',
      taxNumber: '33AABCM9988D1Z8',
      billingAddress: '12 South Car Street, Tenkasi',
      creditLimit: 50000.0,
      outstandingBalance: 12400.0,
    },
  });

  const custLakshmi = await prisma.customer.upsert({
    where: { id: `cust-lakshmi-${novaOrg.id}` },
    update: {},
    create: {
      id: `cust-lakshmi-${novaOrg.id}`,
      organizationId: novaOrg.id,
      name: 'Sri Lakshmi Retail Mart',
      phone: '+919443223344',
      taxNumber: '33AABCS4455F1Z2',
      billingAddress: '48 Bazaar Street, Tenkasi',
      creditLimit: 30000.0,
      outstandingBalance: 6800.0,
    },
  });

  // Suppliers
  const suppHeritage = await prisma.supplier.upsert({
    where: { id: `supp-heritage-${novaOrg.id}` },
    update: {},
    create: {
      id: `supp-heritage-${novaOrg.id}`,
      organizationId: novaOrg.id,
      name: 'Heritage Foods Dairy Ltd',
      contactPerson: 'S. Narayanan',
      phone: '+914424331122',
      email: 'billing@heritagefoods.in',
      taxNumber: '33AABCH5544E1Z4',
      paymentTermsDays: 15,
      outstandingBalance: 18500.0,
    },
  });

  const suppAachi = await prisma.supplier.upsert({
    where: { id: `supp-aachi-${novaOrg.id}` },
    update: {},
    create: {
      id: `supp-aachi-${novaOrg.id}`,
      organizationId: novaOrg.id,
      name: 'Aachi Spices & Masala Traders',
      contactPerson: 'M. Padmanabhan',
      phone: '+914428339900',
      email: 'orders@aachispices.com',
      taxNumber: '33AABCA1122C1Z9',
      paymentTermsDays: 30,
      outstandingBalance: 24600.0,
    },
  });

  // Sales Invoices
  const inv1 = await prisma.saleInvoice.upsert({
    where: { organizationId_invoiceNumber: { organizationId: novaOrg.id, invoiceNumber: 'INV-2026-001' } },
    update: {},
    create: {
      organizationId: novaOrg.id,
      outletId: tenkasiOutlet.id,
      registerId: regTnk1.id,
      invoiceNumber: 'INV-2026-001',
      customerId: custMurugan.id,
      subtotal: 12000.0,
      discountAmount: 0.0,
      taxableAmount: 11428.57,
      cgstAmount: 285.71,
      sgstAmount: 285.71,
      igstAmount: 0.0,
      totalAmount: 12000.0,
      paidAmount: 6000.0,
      outstandingAmount: 6000.0,
      paymentStatus: 'PARTIALLY_PAID',
      isPosSale: true,
      dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days overdue
      createdByUserId: anandCashier.id,
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      items: {
        create: [
          {
            productId: dbProducts['MILK-01'].id,
            description: 'Fresh Milk 1L Packet',
            quantity: 100,
            unitCost: 48.0,
            unitPrice: 60.0,
            discountAmount: 0.0,
            taxRate: 5.0,
            taxableAmount: 5714.28,
            cgst: 142.86,
            sgst: 142.86,
            igst: 0.0,
            totalAmount: 6000.0,
          },
          {
            productId: dbProducts['COFF-01'].id,
            description: 'Filter Coffee Powder 200g',
            quantity: 42.85,
            unitCost: 105.0,
            unitPrice: 140.0,
            discountAmount: 0.0,
            taxRate: 5.0,
            taxableAmount: 5714.29,
            cgst: 142.85,
            sgst: 142.85,
            igst: 0.0,
            totalAmount: 6000.0,
          },
        ],
      },
    },
  });

  const inv2 = await prisma.saleInvoice.upsert({
    where: { organizationId_invoiceNumber: { organizationId: novaOrg.id, invoiceNumber: 'INV-2026-002' } },
    update: {},
    create: {
      organizationId: novaOrg.id,
      outletId: tenkasiOutlet.id,
      registerId: regTnk1.id,
      invoiceNumber: 'INV-2026-002',
      customerId: custLakshmi.id,
      subtotal: 6800.0,
      discountAmount: 0.0,
      taxableAmount: 6476.19,
      cgstAmount: 161.90,
      sgstAmount: 161.90,
      igstAmount: 0.0,
      totalAmount: 6800.0,
      paidAmount: 0.0,
      outstandingAmount: 6800.0,
      paymentStatus: 'UNPAID',
      isPosSale: true,
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      createdByUserId: anandCashier.id,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      items: {
        create: [
          {
            productId: dbProducts['OIL-01'].id,
            description: 'Refined Sunflower Oil 1L',
            quantity: 50.37,
            unitCost: 110.0,
            unitPrice: 135.0,
            discountAmount: 0.0,
            taxRate: 5.0,
            taxableAmount: 6476.19,
            cgst: 161.90,
            sgst: 161.90,
            igst: 0.0,
            totalAmount: 6800.0,
          },
        ],
      },
    },
  });

  const inv3 = await prisma.saleInvoice.upsert({
    where: { organizationId_invoiceNumber: { organizationId: novaOrg.id, invoiceNumber: 'INV-2026-003' } },
    update: {},
    create: {
      organizationId: novaOrg.id,
      outletId: tenkasiOutlet.id,
      registerId: regTnk1.id,
      invoiceNumber: 'INV-2026-003',
      subtotal: 1450.0,
      discountAmount: 50.0,
      taxableAmount: 1333.33,
      cgstAmount: 33.33,
      sgstAmount: 33.33,
      igstAmount: 0.0,
      totalAmount: 1400.0,
      paidAmount: 1400.0,
      outstandingAmount: 0.0,
      paymentStatus: 'PAID',
      isPosSale: true,
      createdByUserId: anandCashier.id,
      createdAt: new Date(),
      items: {
        create: [
          {
            productId: dbProducts['BREAD-01'].id,
            description: 'Whole Wheat Bread 400g',
            quantity: 10,
            unitCost: 32.0,
            unitPrice: 45.0,
            discountAmount: 0.0,
            taxRate: 5.0,
            taxableAmount: 428.57,
            cgst: 10.71,
            sgst: 10.71,
            igst: 0.0,
            totalAmount: 450.0,
          },
          {
            productId: dbProducts['SODA-01'].id,
            description: 'Sparkling Soda 750ml',
            quantity: 25,
            unitCost: 26.0,
            unitPrice: 40.0,
            discountAmount: 50.0,
            taxRate: 18.0,
            taxableAmount: 805.08,
            cgst: 72.46,
            sgst: 72.46,
            igst: 0.0,
            totalAmount: 950.0,
          },
        ],
      },
    },
  });

  // Purchase Bills
  const bill1 = await prisma.purchaseBill.upsert({
    where: { organizationId_billNumber: { organizationId: novaOrg.id, billNumber: 'PB-2026-101' } },
    update: {},
    create: {
      organizationId: novaOrg.id,
      outletId: tenkasiOutlet.id,
      supplierId: suppHeritage.id,
      billNumber: 'PB-2026-101',
      supplierInvoiceNumber: 'HF-998821',
      subtotal: 25000.0,
      taxableAmount: 23809.52,
      cgstAmount: 595.24,
      sgstAmount: 595.24,
      igstAmount: 0.0,
      totalAmount: 25000.0,
      paidAmount: 6500.0,
      outstandingAmount: 18500.0,
      paymentStatus: 'PARTIALLY_PAID',
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // Due in 5 days
      purchaseDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      items: {
        create: [
          {
            productId: dbProducts['MILK-01'].id,
            description: 'Bulk Fresh Milk Delivery 500L',
            quantity: 500,
            unitCost: 48.0,
            taxRate: 5.0,
            taxableAmount: 23809.52,
            cgst: 595.24,
            sgst: 595.24,
            igst: 0.0,
            totalAmount: 25000.0,
          },
        ],
      },
    },
  });

  const bill2 = await prisma.purchaseBill.upsert({
    where: { organizationId_billNumber: { organizationId: novaOrg.id, billNumber: 'PB-2026-102' } },
    update: {},
    create: {
      organizationId: novaOrg.id,
      outletId: tenkasiOutlet.id,
      supplierId: suppAachi.id,
      billNumber: 'PB-2026-102',
      supplierInvoiceNumber: 'ACH-441199',
      subtotal: 24600.0,
      taxableAmount: 23428.57,
      cgstAmount: 585.71,
      sgstAmount: 585.71,
      igstAmount: 0.0,
      totalAmount: 24600.0,
      paidAmount: 0.0,
      outstandingAmount: 24600.0,
      paymentStatus: 'UNPAID',
      dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days overdue
      purchaseDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      items: {
        create: [
          {
            productId: dbProducts['COFF-01'].id,
            description: 'Premium Roasted Coffee Beans 200kg',
            quantity: 200,
            unitCost: 105.0,
            taxRate: 5.0,
            taxableAmount: 23428.57,
            cgst: 585.71,
            sgst: 585.71,
            igst: 0.0,
            totalAmount: 24600.0,
          },
        ],
      },
    },
  });

  // Payments & Receipts
  await prisma.payment.upsert({
    where: { organizationId_paymentNumber: { organizationId: novaOrg.id, paymentNumber: 'RCPT-2026-001' } },
    update: {},
    create: {
      organizationId: novaOrg.id,
      outletId: tenkasiOutlet.id,
      paymentNumber: 'RCPT-2026-001',
      type: 'CUSTOMER_RECEIPT',
      customerId: custMurugan.id,
      invoiceId: inv1.id,
      amount: 6000.0,
      paymentMethod: 'UPI',
      referenceNumber: 'UPI/20260815/99881',
      transactionDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      status: 'COMPLETED',
      notes: 'Advance part payment for monthly catering milk supplies',
    },
  });

  await prisma.payment.upsert({
    where: { organizationId_paymentNumber: { organizationId: novaOrg.id, paymentNumber: 'PAY-2026-001' } },
    update: {},
    create: {
      organizationId: novaOrg.id,
      outletId: tenkasiOutlet.id,
      paymentNumber: 'PAY-2026-001',
      type: 'SUPPLIER_PAYMENT',
      supplierId: suppHeritage.id,
      purchaseBillId: bill1.id,
      amount: 6500.0,
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'NEFT/HDFC/20260814',
      transactionDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      status: 'COMPLETED',
      notes: 'Weekly vendor payout',
    },
  });

  // Expenses
  const expData = [
    { number: 'EXP-2026-001', category: 'RENT', description: 'Store Main Floor Lease - August', amount: 22000.0, taxAmount: 0.0, method: 'BANK_TRANSFER', vendor: 'Tenkasi Commercial Realty', date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000) },
    { number: 'EXP-2026-002', category: 'ELECTRICITY', description: 'TNEB Supermarket Commercial Power Bill', amount: 8450.0, taxAmount: 0.0, method: 'UPI', vendor: 'TNEB Electricity Board', date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
    { number: 'EXP-2026-003', category: 'MAINTENANCE', description: 'Chiller & Deep Freezer Compressor Service', amount: 2600.0, taxAmount: 468.0, method: 'CASH', vendor: 'CoolTech Refrigeration', date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
    { number: 'EXP-2026-004', category: 'UTILITIES', description: 'High-Speed Broadband & POS Internet Connection', amount: 1499.0, taxAmount: 269.82, method: 'UPI', vendor: 'Airtel Enterprise', date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
  ];

  for (const exp of expData) {
    await prisma.expense.upsert({
      where: { organizationId_expenseNumber: { organizationId: novaOrg.id, expenseNumber: exp.number } },
      update: {},
      create: {
        organizationId: novaOrg.id,
        outletId: tenkasiOutlet.id,
        expenseNumber: exp.number,
        category: exp.category,
        description: exp.description,
        amount: exp.amount,
        taxAmount: exp.taxAmount,
        paymentMethod: exp.method,
        vendorName: exp.vendor,
        expenseDate: exp.date,
        status: 'PAID',
      },
    });
  }

  // Register Session
  await prisma.registerSession.create({
    data: {
      organizationId: novaOrg.id,
      outletId: tenkasiOutlet.id,
      registerId: regTnk1.id,
      openedByUserId: anandCashier.id,
      openingFloat: 5000.0,
      cashSales: 1400.0,
      cashReceipts: 0.0,
      cashRefunds: 0.0,
      cashPaidOut: 2600.0, // Chiller maintenance paid out of till
      expectedClosingCash: 3800.0,
      actualClosingCash: 3800.0,
      cashDifference: 0.0,
      status: 'OPEN',
      openedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
    },
  });

  console.log('✅ Database Seeding Completed Successfully!');
  console.log(`
  Demo Accounts Created:
  -------------------------------------------------------------
  👑 Super Admin: admin@aescion.com       / Admin@12345
  🏬 Multi-Outlet Owner: priya@novamart.com   / Password@123
  👔 Store Manager: karthik@novamart.com  / Password@123
  💳 Cashier: anand@novamart.com          / Password@123
  📊 Accountant: suresh@novamart.com       / Password@123
  🏪 Single-Shop Owner: ramesh@apexquick.com / Password@123
  -------------------------------------------------------------
  `);
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
