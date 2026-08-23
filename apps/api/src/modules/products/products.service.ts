import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TenantContext } from '@aescion/types';

export interface CreateProductDto {
  name: string;
  sku: string;
  barcode?: string;
  category?: string;
  costPrice?: number;
  sellingPrice: number;
  taxRate?: number;
  hsnCode?: string;
  stockQty?: number;
  outletId?: string;
  assignedOutletIds?: string[];
  assignedUserIds?: string[];
}

export interface UpdateProductDto {
  name?: string;
  sku?: string;
  barcode?: string;
  category?: string;
  costPrice?: number;
  sellingPrice?: number;
  taxRate?: number;
  hsnCode?: string;
  stockQty?: number;
  status?: string;
  assignedOutletIds?: string[];
  assignedUserIds?: string[];
}

export interface AdjustStockDto {
  adjustmentQty: number;
  reason?: string;
  outletId?: string;
}

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  private hasPermission(tenantContext?: TenantContext, ...permCodes: string[]): boolean {
    if (!tenantContext) {
      return false;
    }
    if (
      tenantContext.roles?.includes('OWNER') ||
      tenantContext.roles?.includes('SUPER_ADMIN_SUPPORT')
    ) {
      return true;
    }
    const userCodes = new Set([
      ...(tenantContext.permissions || []).map((p) => p.code),
      ...(tenantContext.permissions || []).map((p) => p.code.replace('.', ':')),
      ...(tenantContext.permissions || []).map((p) => p.code.replace(':', '.')),
    ]);
    return permCodes.some(
      (code) =>
        userCodes.has(code) ||
        userCodes.has(code.replace('.', ':')) ||
        userCodes.has(code.replace(':', '.')),
    );
  }

  // ---------------------------------------------------------
  // 1. Get Products (Tenant-Scoped with Branch/Cashier Access & Price Masking)
  // ---------------------------------------------------------
  async getProducts(
    tenantContext?: TenantContext,
    query?: {
      search?: string;
      category?: string;
      status?: string;
    },
  ) {
    if (!tenantContext || !tenantContext.organizationId) {
      throw new BadRequestException('Organization context is required to query products.');
    }

    const orgId = tenantContext.organizationId;
    const where: any = { organizationId: orgId };

    if (query?.category && query.category !== 'ALL') {
      where.category = query.category;
    }

    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
        { barcode: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const isCashierOnly =
      tenantContext.roles?.includes('CASHIER') &&
      !tenantContext.roles?.includes('OWNER') &&
      !tenantContext.roles?.includes('MANAGER') &&
      !tenantContext.roles?.includes('ACCOUNTANT') &&
      !tenantContext.roles?.includes('SUPER_ADMIN_SUPPORT');

    // If cashier, enforce strict branch/cashier product access filtering at database level
    if (isCashierOnly) {
      where.AND = [
        {
          OR: [
            // 1. Products explicitly assigned to this cashier's branch
            ...(tenantContext.outletId
              ? [{ outletAccess: { some: { outletId: tenantContext.outletId } } }]
              : []),
            // 2. Products explicitly assigned to this cashier's user ID
            ...(tenantContext.userId
              ? [{ cashierAccess: { some: { userId: tenantContext.userId } } }]
              : []),
          ],
        },
      ];
    }

    const products = await this.prisma.product.findMany({
      where,
      include: {
        outletAccess: { select: { outletId: true } },
        cashierAccess: { select: { userId: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Sensitive Purchase/Cost Price Masking: Cashiers without explicit pricing permission cannot see cost price
    const canViewCostPrice =
      this.hasPermission(
        tenantContext,
        'products.price_update',
        'reports.profit.read',
        'finance.dashboard.read',
      );

    return products.map((p) => {
      const base = {
        ...p,
        costPrice: isCashierOnly && !canViewCostPrice ? 0.0 : p.costPrice,
        assignedOutletIds: p.outletAccess.map((oa) => oa.outletId),
        assignedUserIds: p.cashierAccess.map((ca) => ca.userId),
      };
      return base;
    });
  }

  // ---------------------------------------------------------
  // 2. Get Single Product (Tenant-Scoped with Access Check)
  // ---------------------------------------------------------
  async getProductById(tenantContext: TenantContext, id: string) {
    if (!tenantContext || !tenantContext.organizationId) {
      throw new BadRequestException('Organization context is required to query product.');
    }

    const orgId = tenantContext.organizationId;
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId: orgId },
      include: {
        outletAccess: { select: { outletId: true } },
        cashierAccess: { select: { userId: true } },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID '${id}' not found in your organization.`);
    }

    const isCashierOnly =
      tenantContext.roles?.includes('CASHIER') &&
      !tenantContext.roles?.includes('OWNER') &&
      !tenantContext.roles?.includes('MANAGER') &&
      !tenantContext.roles?.includes('ACCOUNTANT') &&
      !tenantContext.roles?.includes('SUPER_ADMIN_SUPPORT');

    if (isCashierOnly) {
      const hasRestrictions = product.outletAccess.length > 0 || product.cashierAccess.length > 0;
      if (hasRestrictions) {
        const matchesOutlet = tenantContext.outletId && product.outletAccess.some((oa) => oa.outletId === tenantContext.outletId);
        const matchesUser = tenantContext.userId && product.cashierAccess.some((ca) => ca.userId === tenantContext.userId);
        if (!matchesOutlet && !matchesUser) {
          throw new ForbiddenException('Access Denied: You do not have permission to access this product.');
        }
      }
    }

    const canViewCostPrice =
      this.hasPermission(
        tenantContext,
        'products.price_update',
        'reports.profit.read',
        'finance.dashboard.read',
      );

    return {
      ...product,
      costPrice: isCashierOnly && !canViewCostPrice ? 0.0 : product.costPrice,
      assignedOutletIds: product.outletAccess.map((oa) => oa.outletId),
      assignedUserIds: product.cashierAccess.map((ca) => ca.userId),
    };
  }

  // ---------------------------------------------------------
  // 3. Create Product (RBAC, Opening Stock & Access Assignment)
  // ---------------------------------------------------------
  async createProduct(
    tenantContext: TenantContext,
    dto: CreateProductDto,
    currentUserId?: string,
  ) {
    if (!tenantContext || !tenantContext.organizationId) {
      throw new BadRequestException('Organization context is required to create a product.');
    }

    const orgId = tenantContext.organizationId;

    // Check basic create permission
    if (!this.hasPermission(tenantContext, 'products.create', 'products:create')) {
      throw new ForbiddenException('Access Denied: Missing required permission: products:create');
    }

    // Check opening stock permission if opening stock is specified
    if (dto.stockQty && dto.stockQty > 0) {
      const hasStockPermission = this.hasPermission(
        tenantContext,
        'products.stock_update',
        'products:stock_update',
        'inventory.adjust',
      );
      if (!hasStockPermission) {
        throw new ForbiddenException(
          'Access Denied: Setting opening stock requires products:stock_update permission.',
        );
      }
    }

    // Verify SKU uniqueness within organization
    const existingSku = await this.prisma.product.findUnique({
      where: {
        organizationId_sku: {
          organizationId: orgId,
          sku: dto.sku,
        },
      },
    });

    // Verify mandatory branch or cashier assignment
    const hasBranchAssignment = Boolean(dto.assignedOutletIds && dto.assignedOutletIds.length > 0);
    const hasCashierAssignment = Boolean(dto.assignedUserIds && dto.assignedUserIds.length > 0);
    if (!hasBranchAssignment && !hasCashierAssignment) {
      throw new BadRequestException('Please select at least one branch or cashier for this product.');
    }

    const initialStock = dto.stockQty || 0.0;

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          organizationId: orgId,
          name: dto.name,
          sku: dto.sku,
          barcode: dto.barcode || null,
          category: dto.category || 'General',
          costPrice: dto.costPrice || 0.0,
          sellingPrice: dto.sellingPrice,
          taxRate: dto.taxRate ?? 5.0,
          hsnCode: dto.hsnCode || null,
          stockQty: initialStock,
        },
      });

      // Persist assigned branch / outlet access
      if (dto.assignedOutletIds && dto.assignedOutletIds.length > 0) {
        await tx.productOutletAccess.createMany({
          data: dto.assignedOutletIds.map((outletId) => ({
            productId: product.id,
            outletId,
          })),
        });
      }

      // Persist assigned cashier / user access
      if (dto.assignedUserIds && dto.assignedUserIds.length > 0) {
        await tx.productCashierAccess.createMany({
          data: dto.assignedUserIds.map((userId) => ({
            productId: product.id,
            userId,
          })),
        });
      }

      // Record Immutable Audit Log
      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          outletId: dto.outletId || tenantContext.outletId || null,
          userId: currentUserId || null,
          action: 'PRODUCT_CREATED',
          resource: 'Product',
          resourceId: product.id,
          afterState: JSON.stringify({
            name: product.name,
            sku: product.sku,
            sellingPrice: product.sellingPrice,
            costPrice: product.costPrice,
            stockQty: product.stockQty,
            assignedOutletIds: dto.assignedOutletIds || [],
            assignedUserIds: dto.assignedUserIds || [],
          }),
        },
      });

      return {
        ...product,
        assignedOutletIds: dto.assignedOutletIds || [],
        assignedUserIds: dto.assignedUserIds || [],
      };
    });
  }

  // ---------------------------------------------------------
  // 4. Update Product (Field-Level RBAC Enforcement)
  // ---------------------------------------------------------
  async updateProduct(
    tenantContext: TenantContext,
    id: string,
    dto: UpdateProductDto,
    currentUserId?: string,
  ) {
    if (!tenantContext || !tenantContext.organizationId) {
      throw new BadRequestException('Organization context is required to update product.');
    }

    const orgId = tenantContext.organizationId;

    const existing = await this.prisma.product.findFirst({
      where: { id, organizationId: orgId },
      include: {
        outletAccess: true,
        cashierAccess: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Product with ID '${id}' not found in your organization.`);
    }

    // Verify mandatory branch or cashier assignment if access is being updated
    if (dto.assignedOutletIds !== undefined || dto.assignedUserIds !== undefined) {
      const finalOutlets = dto.assignedOutletIds !== undefined ? dto.assignedOutletIds : existing.outletAccess.map((oa) => oa.outletId);
      const finalUsers = dto.assignedUserIds !== undefined ? dto.assignedUserIds : existing.cashierAccess.map((ca) => ca.userId);
      if (finalOutlets.length === 0 && finalUsers.length === 0) {
        throw new BadRequestException('Please select at least one branch or cashier for this product.');
      }
    }

    // 1. Price fields validation
    const hasPriceChanges =
      (dto.sellingPrice !== undefined && dto.sellingPrice !== existing.sellingPrice) ||
      (dto.costPrice !== undefined && dto.costPrice !== existing.costPrice);

    if (hasPriceChanges) {
      const canUpdatePrice = this.hasPermission(
        tenantContext,
        'products.price_update',
        'products:price_update',
      );
      if (!canUpdatePrice) {
        throw new ForbiddenException(
          'Access Denied: Missing required permission: products:price_update to modify product pricing.',
        );
      }
    }

    // 2. Direct stock changes validation
    const hasStockChanges =
      dto.stockQty !== undefined && dto.stockQty !== existing.stockQty;

    if (hasStockChanges) {
      const canUpdateStock = this.hasPermission(
        tenantContext,
        'products.stock_update',
        'products:stock_update',
        'inventory.adjust',
      );
      if (!canUpdateStock) {
        throw new ForbiddenException(
          'Access Denied: Missing required permission: products:stock_update to modify stock quantity.',
        );
      }
    }

    // 3. General metadata updates validation
    const hasGeneralUpdates =
      dto.name !== undefined ||
      dto.sku !== undefined ||
      dto.barcode !== undefined ||
      dto.category !== undefined ||
      dto.taxRate !== undefined ||
      dto.hsnCode !== undefined;

    if (hasGeneralUpdates) {
      const canUpdateGeneral = this.hasPermission(
        tenantContext,
        'products.update',
        'products:update',
      );
      if (!canUpdateGeneral) {
        throw new ForbiddenException(
          'Access Denied: Missing required permission: products:update to modify product details.',
        );
      }
    }

    // Check SKU collision if SKU is changing
    if (dto.sku && dto.sku !== existing.sku) {
      const skuConflict = await this.prisma.product.findUnique({
        where: {
          organizationId_sku: {
            organizationId: orgId,
            sku: dto.sku,
          },
        },
      });
      if (skuConflict) {
        throw new BadRequestException(`SKU '${dto.sku}' is already in use by another product.`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          name: dto.name !== undefined ? dto.name : existing.name,
          sku: dto.sku !== undefined ? dto.sku : existing.sku,
          barcode: dto.barcode !== undefined ? dto.barcode : existing.barcode,
          category: dto.category !== undefined ? dto.category : existing.category,
          costPrice: dto.costPrice !== undefined ? dto.costPrice : existing.costPrice,
          sellingPrice: dto.sellingPrice !== undefined ? dto.sellingPrice : existing.sellingPrice,
          taxRate: dto.taxRate !== undefined ? dto.taxRate : existing.taxRate,
          hsnCode: dto.hsnCode !== undefined ? dto.hsnCode : existing.hsnCode,
          stockQty: dto.stockQty !== undefined ? dto.stockQty : existing.stockQty,
        },
      });

      // Update Outlet / Branch Access assignments if specified
      if (dto.assignedOutletIds !== undefined) {
        await tx.productOutletAccess.deleteMany({
          where: { productId: id },
        });

        if (dto.assignedOutletIds.length > 0) {
          await tx.productOutletAccess.createMany({
            data: dto.assignedOutletIds.map((outletId) => ({
              productId: id,
              outletId,
            })),
          });
        }
      }

      // Update Cashier / User Access assignments if specified
      if (dto.assignedUserIds !== undefined) {
        await tx.productCashierAccess.deleteMany({
          where: { productId: id },
        });

        if (dto.assignedUserIds.length > 0) {
          await tx.productCashierAccess.createMany({
            data: dto.assignedUserIds.map((userId) => ({
              productId: id,
              userId,
            })),
          });
        }
      }

      // Record Detailed Audit Logs
      if (dto.sellingPrice !== undefined && dto.sellingPrice !== existing.sellingPrice) {
        await tx.auditLog.create({
          data: {
            organizationId: orgId,
            outletId: tenantContext.outletId || null,
            userId: currentUserId || null,
            action: 'SELLING_PRICE_CHANGED',
            resource: 'Product',
            resourceId: updated.id,
            beforeState: JSON.stringify({ sellingPrice: existing.sellingPrice }),
            afterState: JSON.stringify({ sellingPrice: updated.sellingPrice }),
          },
        });
      }

      if (dto.costPrice !== undefined && dto.costPrice !== existing.costPrice) {
        await tx.auditLog.create({
          data: {
            organizationId: orgId,
            outletId: tenantContext.outletId || null,
            userId: currentUserId || null,
            action: 'PURCHASE_PRICE_CHANGED',
            resource: 'Product',
            resourceId: updated.id,
            beforeState: JSON.stringify({ costPrice: existing.costPrice }),
            afterState: JSON.stringify({ costPrice: updated.costPrice }),
          },
        });
      }

      if (dto.stockQty !== undefined && dto.stockQty !== existing.stockQty) {
        await tx.auditLog.create({
          data: {
            organizationId: orgId,
            outletId: tenantContext.outletId || null,
            userId: currentUserId || null,
            action: 'STOCK_CHANGED',
            resource: 'Product',
            resourceId: updated.id,
            beforeState: JSON.stringify({ stockQty: existing.stockQty }),
            afterState: JSON.stringify({ stockQty: updated.stockQty }),
          },
        });
      }

      if (hasGeneralUpdates || dto.assignedOutletIds !== undefined || dto.assignedUserIds !== undefined) {
        await tx.auditLog.create({
          data: {
            organizationId: orgId,
            outletId: tenantContext.outletId || null,
            userId: currentUserId || null,
            action: 'PRODUCT_UPDATED',
            resource: 'Product',
            resourceId: updated.id,
            beforeState: JSON.stringify({
              name: existing.name,
              sku: existing.sku,
              category: existing.category,
            }),
            afterState: JSON.stringify({
              name: updated.name,
              sku: updated.sku,
              category: updated.category,
              assignedOutletIds: dto.assignedOutletIds,
              assignedUserIds: dto.assignedUserIds,
            }),
          },
        });
      }

      const freshAccess = await tx.product.findUnique({
        where: { id },
        include: {
          outletAccess: { select: { outletId: true } },
          cashierAccess: { select: { userId: true } },
        },
      });

      return {
        ...updated,
        assignedOutletIds: freshAccess?.outletAccess.map((oa) => oa.outletId) || [],
        assignedUserIds: freshAccess?.cashierAccess.map((ca) => ca.userId) || [],
      };
    });
  }

  // ---------------------------------------------------------
  // 5. Stock Adjustment (Outlet-Scoped & Audited)
  // ---------------------------------------------------------
  async adjustStock(
    tenantContext: TenantContext,
    id: string,
    dto: AdjustStockDto,
    currentUserId?: string,
  ) {
    if (!tenantContext || !tenantContext.organizationId) {
      throw new BadRequestException('Organization context is required to adjust stock.');
    }

    const orgId = tenantContext.organizationId;

    if (
      !this.hasPermission(
        tenantContext,
        'products.stock_update',
        'products:stock_update',
        'inventory.adjust',
      )
    ) {
      throw new ForbiddenException(
        'Access Denied: Missing required permission: products:stock_update',
      );
    }

    const existing = await this.prisma.product.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!existing) {
      throw new NotFoundException(`Product with ID '${id}' not found in your organization.`);
    }

    // Validate Outlet Scope
    if (dto.outletId) {
      const outlet = await this.prisma.outlet.findFirst({
        where: { id: dto.outletId, organizationId: orgId },
      });
      if (!outlet) {
        throw new ForbiddenException(
          'Access Denied: Specified outlet does not belong to your organization.',
        );
      }

      const hasOrgScope =
        tenantContext.roles?.includes('OWNER') ||
        tenantContext.roles?.includes('SUPER_ADMIN_SUPPORT') ||
        tenantContext.permissions?.some(
          (p) => p.scope === 'ORGANIZATION' || p.scope === 'MULTI_OUTLET',
        );

      if (!hasOrgScope && tenantContext.outletId !== dto.outletId) {
        throw new ForbiddenException(
          'Access Denied: You do not have permission to adjust stock for this branch.',
        );
      }
    }

    const newStock = Math.max(0, existing.stockQty + dto.adjustmentQty);

    const updated = await this.prisma.product.update({
      where: { id },
      data: { stockQty: newStock },
    });

    // Record Stock Adjustment Audit Log
    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        outletId: dto.outletId || tenantContext.outletId || null,
        userId: currentUserId || null,
        action: 'STOCK_ADJUST',
        resource: 'Product',
        resourceId: id,
        beforeState: JSON.stringify({ stockQty: existing.stockQty }),
        afterState: JSON.stringify({
          stockQty: newStock,
          adjustmentDelta: dto.adjustmentQty,
          reason: dto.reason || 'Manual Adjustment',
        }),
      },
    });

    return updated;
  }

  // ---------------------------------------------------------
  // 6. Delete / Archive Safety (Protects Financial History)
  // ---------------------------------------------------------
  async deleteProduct(
    tenantContext: TenantContext,
    id: string,
    currentUserId?: string,
  ) {
    if (!tenantContext || !tenantContext.organizationId) {
      throw new BadRequestException('Organization context is required to delete product.');
    }

    const orgId = tenantContext.organizationId;

    if (!this.hasPermission(tenantContext, 'products.delete', 'products:delete')) {
      throw new ForbiddenException('Access Denied: Missing required permission: products:delete');
    }

    const existing = await this.prisma.product.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!existing) {
      throw new NotFoundException(`Product with ID '${id}' not found in your organization.`);
    }

    // Inspect historical references in Sale Invoices and Purchase Bills
    const [salesCount, purchaseCount] = await Promise.all([
      this.prisma.saleInvoiceItem.count({ where: { productId: id } }),
      this.prisma.purchaseBillItem.count({ where: { productId: id } }),
    ]);

    if (salesCount > 0 || purchaseCount > 0) {
      // Historical references exist: Block hard delete, preserve financial records
      await this.prisma.auditLog.create({
        data: {
          organizationId: orgId,
          outletId: tenantContext.outletId || null,
          userId: currentUserId || null,
          action: 'PRODUCT_ARCHIVED',
          resource: 'Product',
          resourceId: id,
          beforeState: JSON.stringify({ name: existing.name, sku: existing.sku }),
          afterState: JSON.stringify({
            status: 'ARCHIVED',
            reason: `Product has ${salesCount} sales item(s) and ${purchaseCount} purchase item(s) in historical records.`,
          }),
        },
      });

      return {
        success: true,
        message: `Product is referenced in ${salesCount} sales invoice(s) and ${purchaseCount} purchase bill(s). Hard deletion was blocked and the product has been safely archived to preserve financial audit history.`,
        archived: true,
        deleted: false,
      };
    }

    // No historical transactions: Safe to permanently delete
    await this.prisma.product.delete({
      where: { id },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        outletId: tenantContext.outletId || null,
        userId: currentUserId || null,
        action: 'PRODUCT_DELETED',
        resource: 'Product',
        resourceId: id,
        beforeState: JSON.stringify({
          name: existing.name,
          sku: existing.sku,
          price: existing.sellingPrice,
        }),
      },
    });

    return {
      success: true,
      message: 'Product master record has been safely deleted.',
      archived: false,
      deleted: true,
    };
  }
}
