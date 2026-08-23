import { ProductsService } from '../src/modules/products/products.service';
import { TenantContext, PermissionScope } from '@aescion/types';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('Product Management RBAC & Permission Enforcement', () => {
  let productsService: ProductsService;
  let mockPrisma: any;

  const tenantA: TenantContext = {
    organizationId: 'org-nova-123',
    organizationName: 'Nova Supermarket',
    outletId: 'outlet-tenkasi-1',
    outletName: 'Tenkasi Branch',
    userId: 'user-owner-1',
    roles: ['OWNER'],
    permissions: [
      { code: 'products.read', scope: PermissionScope.ORGANIZATION },
      { code: 'products.create', scope: PermissionScope.ORGANIZATION },
      { code: 'products.update', scope: PermissionScope.ORGANIZATION },
      { code: 'products.price_update', scope: PermissionScope.ORGANIZATION },
      { code: 'products.stock_update', scope: PermissionScope.ORGANIZATION },
      { code: 'products.delete', scope: PermissionScope.ORGANIZATION },
    ],
    authorityLimits: {
      maxDiscountPercent: 100,
      canOverridePrice: true,
      approvalLimit: 1000000,
    },
  };

  const managerTenant: TenantContext = {
    organizationId: 'org-nova-123',
    organizationName: 'Nova Supermarket',
    outletId: 'outlet-tenkasi-1',
    outletName: 'Tenkasi Branch',
    userId: 'user-manager-1',
    roles: ['MANAGER'],
    permissions: [
      { code: 'products.read', scope: PermissionScope.OUTLET },
      { code: 'products.create', scope: PermissionScope.OUTLET },
      { code: 'products.update', scope: PermissionScope.OUTLET },
      { code: 'products.price_update', scope: PermissionScope.OUTLET },
      { code: 'products.stock_update', scope: PermissionScope.OUTLET },
    ],
    authorityLimits: {
      maxDiscountPercent: 20,
      canOverridePrice: true,
      approvalLimit: 50000,
    },
  };

  const cashierTenant: TenantContext = {
    organizationId: 'org-nova-123',
    organizationName: 'Nova Supermarket',
    outletId: 'outlet-tenkasi-1',
    outletName: 'Tenkasi Branch',
    userId: 'user-cashier-1',
    roles: ['CASHIER'],
    permissions: [
      { code: 'products.read', scope: PermissionScope.OUTLET },
      { code: 'sales.create', scope: PermissionScope.OUTLET },
      { code: 'sales.read', scope: PermissionScope.OUTLET },
    ],
    authorityLimits: {
      maxDiscountPercent: 5,
      canOverridePrice: false,
      approvalLimit: 1000,
    },
  };

  const accountantTenant: TenantContext = {
    organizationId: 'org-nova-123',
    organizationName: 'Nova Supermarket',
    outletId: 'outlet-tenkasi-1',
    outletName: 'Tenkasi Branch',
    userId: 'user-acct-1',
    roles: ['ACCOUNTANT'],
    permissions: [
      { code: 'products.read', scope: PermissionScope.ORGANIZATION },
      { code: 'reports.sales.read', scope: PermissionScope.ORGANIZATION },
      { code: 'finance.dashboard.read', scope: PermissionScope.ORGANIZATION },
    ],
    authorityLimits: {
      maxDiscountPercent: 0,
      canOverridePrice: false,
      approvalLimit: 0,
    },
  };

  const tenantB: TenantContext = {
    organizationId: 'org-apex-456',
    organizationName: 'Apex QuickStore',
    outletId: 'outlet-madurai-1',
    outletName: 'Madurai Store',
    userId: 'user-ramesh-1',
    roles: ['OWNER'],
    permissions: [
      { code: 'products.read', scope: PermissionScope.ORGANIZATION },
      { code: 'products.create', scope: PermissionScope.ORGANIZATION },
    ],
    authorityLimits: {
      maxDiscountPercent: 100,
      canOverridePrice: true,
      approvalLimit: 1000000,
    },
  };

  beforeEach(() => {
    mockPrisma = {
      product: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      outlet: {
        findFirst: jest.fn(),
      },
      saleInvoiceItem: {
        count: jest.fn(),
      },
      purchaseBillItem: {
        count: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    productsService = new ProductsService(mockPrisma);
  });

  describe('1. Role-Based Creation & Opening Stock Checks', () => {
    it('Owner should be allowed to create product with opening stock', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      mockPrisma.product.create.mockResolvedValue({
        id: 'prod-1',
        name: 'Basmati Rice 5kg',
        sku: 'RICE-5KG',
        sellingPrice: 480,
        costPrice: 400,
        stockQty: 50,
      });

      const result = await productsService.createProduct(tenantA, {
        name: 'Basmati Rice 5kg',
        sku: 'RICE-5KG',
        sellingPrice: 480,
        costPrice: 400,
        stockQty: 50,
      });

      expect(result.id).toBe('prod-1');
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'PRODUCT_CREATED' }),
        }),
      );
    });

    it('Cashier should be blocked from creating products (403 Forbidden)', async () => {
      await expect(
        productsService.createProduct(cashierTenant, {
          name: 'Chocolate Bar',
          sku: 'CHOC-01',
          sellingPrice: 50,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Accountant should be blocked from creating products (403 Forbidden)', async () => {
      await expect(
        productsService.createProduct(accountantTenant, {
          name: 'Ledger Book',
          sku: 'BOOK-01',
          sellingPrice: 150,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('User with create permission but WITHOUT stock_update permission should be blocked from setting opening stock > 0', async () => {
      const userWithoutStockPerm: TenantContext = {
        ...managerTenant,
        roles: ['STAFF'],
        permissions: [{ code: 'products.create', scope: PermissionScope.OUTLET }],
      };

      await expect(
        productsService.createProduct(userWithoutStockPerm, {
          name: 'Green Tea',
          sku: 'TEA-01',
          sellingPrice: 120,
          stockQty: 100,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('2. Field-Level Update Permissions (Price, Stock & Metadata)', () => {
    const existingProduct = {
      id: 'prod-milk-1',
      organizationId: 'org-nova-123',
      name: 'Milk 1L',
      sku: 'MILK-01',
      barcode: '123456',
      category: 'Dairy',
      costPrice: 50,
      sellingPrice: 60,
      taxRate: 5,
      stockQty: 25,
    };

    it('Manager with price_update should be able to change selling and cost price', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(existingProduct);
      mockPrisma.product.update.mockResolvedValue({
        ...existingProduct,
        sellingPrice: 65,
        costPrice: 55,
      });

      const updated = await productsService.updateProduct(managerTenant, 'prod-milk-1', {
        sellingPrice: 65,
        costPrice: 55,
      });

      expect(updated.sellingPrice).toBe(65);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'SELLING_PRICE_CHANGED' }),
        }),
      );
    });

    it('User with update permission but WITHOUT price_update should be blocked from changing selling price', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(existingProduct);
      const userWithoutPricePerm: TenantContext = {
        ...managerTenant,
        roles: ['STAFF'],
        permissions: [{ code: 'products.update', scope: PermissionScope.OUTLET }],
      };

      await expect(
        productsService.updateProduct(userWithoutPricePerm, 'prod-milk-1', {
          sellingPrice: 75,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('User with update permission but WITHOUT stock_update should be blocked from altering stockQty directly', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(existingProduct);
      const userWithoutStockPerm: TenantContext = {
        ...managerTenant,
        roles: ['STAFF'],
        permissions: [{ code: 'products.update', scope: PermissionScope.OUTLET }],
      };

      await expect(
        productsService.updateProduct(userWithoutStockPerm, 'prod-milk-1', {
          stockQty: 500,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Cashier should be blocked from general update (403 Forbidden)', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(existingProduct);
      await expect(
        productsService.updateProduct(cashierTenant, 'prod-milk-1', {
          name: 'Renamed Milk',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('3. Stock Adjustment & Outlet Scoping', () => {
    it('Should adjust stock and write an immutable audit log', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({
        id: 'prod-oil-1',
        organizationId: 'org-nova-123',
        name: 'Sunflower Oil 1L',
        stockQty: 40,
      });
      mockPrisma.outlet.findFirst.mockResolvedValue({
        id: 'outlet-tenkasi-1',
        organizationId: 'org-nova-123',
      });
      mockPrisma.product.update.mockResolvedValue({
        id: 'prod-oil-1',
        stockQty: 60,
      });

      const res = await productsService.adjustStock(managerTenant, 'prod-oil-1', {
        adjustmentQty: 20,
        reason: 'Restock Shipment Received',
        outletId: 'outlet-tenkasi-1',
      });

      expect(res.stockQty).toBe(60);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'STOCK_ADJUST',
            resourceId: 'prod-oil-1',
          }),
        }),
      );
    });

    it('Should deny stock adjustment if outlet belongs to another organization', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({
        id: 'prod-oil-1',
        organizationId: 'org-nova-123',
        stockQty: 40,
      });
      mockPrisma.outlet.findFirst.mockResolvedValue(null); // Outlet not in org-nova-123

      await expect(
        productsService.adjustStock(managerTenant, 'prod-oil-1', {
          adjustmentQty: 10,
          outletId: 'foreign-outlet-999',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('4. Reference Integrity & Delete/Archive Safety', () => {
    it('Unused product should be permanently deleted by Owner', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({
        id: 'prod-unused-1',
        organizationId: 'org-nova-123',
        name: 'Trial Product',
        sku: 'TRIAL-01',
      });
      mockPrisma.saleInvoiceItem.count.mockResolvedValue(0);
      mockPrisma.purchaseBillItem.count.mockResolvedValue(0);

      const res = await productsService.deleteProduct(tenantA, 'prod-unused-1');

      expect(res.deleted).toBe(true);
      expect(mockPrisma.product.delete).toHaveBeenCalledWith({ where: { id: 'prod-unused-1' } });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'PRODUCT_DELETED' }),
        }),
      );
    });

    it('Product with historical transactions should BLOCK hard delete and safely ARCHIVE', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({
        id: 'prod-used-1',
        organizationId: 'org-nova-123',
        name: 'Fresh Milk 1L',
        sku: 'MILK-01',
      });
      mockPrisma.saleInvoiceItem.count.mockResolvedValue(14);
      mockPrisma.purchaseBillItem.count.mockResolvedValue(2);

      const res = await productsService.deleteProduct(tenantA, 'prod-used-1');

      expect(res.archived).toBe(true);
      expect(res.deleted).toBe(false);
      expect(mockPrisma.product.delete).not.toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'PRODUCT_ARCHIVED' }),
        }),
      );
    });

    it('Manager without products:delete should be blocked from deleting products (403 Forbidden)', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({
        id: 'prod-1',
        organizationId: 'org-nova-123',
      });

      await expect(
        productsService.deleteProduct(managerTenant, 'prod-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('5. Strict Organization & Tenant Isolation', () => {
    it('Should never return products from another organization', async () => {
      mockPrisma.product.findMany.mockImplementation((args: any) => {
        expect(args.where.organizationId).toBe('org-nova-123');
        return Promise.resolve([]);
      });

      await productsService.getProducts(tenantA);
    });

    it('Single product lookup should throw 404 if product belongs to another tenant', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null); // Not in tenantB org

      await expect(
        productsService.getProductById(tenantB, 'prod-nova-private-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('Cashier product query should mask cost price (return 0.0)', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: '1', name: 'Bread', sellingPrice: 45, costPrice: 32 },
      ]);

      const items = await productsService.getProducts(cashierTenant);

      expect(items[0].sellingPrice).toBe(45);
      expect(items[0].costPrice).toBe(0.0); // Sensitive purchase price masked
    });
  });
});
