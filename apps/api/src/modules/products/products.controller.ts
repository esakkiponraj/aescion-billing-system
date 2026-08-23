import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ProductsService,
  CreateProductDto,
  UpdateProductDto,
  AdjustStockDto,
} from './products.service';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permissions, TenantContext } from '@aescion/types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermissions(Permissions.PRODUCTS_READ)
  async getProducts(
    @CurrentTenant() tenant: TenantContext,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
  ) {
    return this.productsService.getProducts(tenant, { search, category, status });
  }

  @Get(':id')
  @RequirePermissions(Permissions.PRODUCTS_READ)
  async getProduct(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.productsService.getProductById(tenant, id);
  }

  @Post()
  @RequirePermissions(Permissions.PRODUCTS_CREATE)
  async createProduct(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser('id') currentUserId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.createProduct(tenant, dto, currentUserId);
  }

  @Patch(':id')
  async updateProduct(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser('id') currentUserId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    // Dynamic field-level authorization inside productsService.updateProduct
    return this.productsService.updateProduct(tenant, id, dto, currentUserId);
  }

  @Post(':id/adjust-stock')
  @RequirePermissions(Permissions.PRODUCTS_STOCK_UPDATE)
  async adjustStock(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser('id') currentUserId: string,
    @Param('id') id: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.productsService.adjustStock(tenant, id, dto, currentUserId);
  }

  @Delete(':id')
  @RequirePermissions(Permissions.PRODUCTS_DELETE)
  async deleteProduct(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser('id') currentUserId: string,
    @Param('id') id: string,
  ) {
    return this.productsService.deleteProduct(tenant, id, currentUserId);
  }
}
