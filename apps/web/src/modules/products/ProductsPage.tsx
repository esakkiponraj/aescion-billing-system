import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Sliders,
  DollarSign,
  Edit2,
  Trash2,
  Lock,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Layers,
  ArrowUpDown,
  Boxes,
  Users,
  Store,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Table } from '../../components/common/Table';
import { apiRequest } from '../../services/api';
import { useTenantStore } from '../../stores/tenantStore';
import { useAuthStore } from '../../stores/authStore';
import { getBusinessTypeCapability } from '@aescion/types';

interface ProductRecord {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  category: string;
  costPrice: number;
  sellingPrice: number;
  taxRate: number;
  stockQty: number;
  hsnCode?: string | null;
  assignedOutletIds?: string[];
  assignedUserIds?: string[];
  createdAt: string;
}

interface OutletItem {
  id: string;
  name: string;
  code: string;
}

interface MemberItem {
  membershipId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  primaryRole?: {
    name: string;
    code: string;
  } | null;
}

export const ProductsPage: React.FC = () => {
  const { businessType, roles, activeOutletName, activeOutletId } = useTenantStore();
  const { user } = useAuthStore();
  const capabilities = getBusinessTypeCapability(businessType);

  const isOwner = roles.includes('OWNER');
  const isManager = roles.includes('MANAGER');
  const isCashier = roles.includes('CASHIER') && !isOwner && !isManager && !roles.includes('ACCOUNTANT');
  const isAccountant = roles.includes('ACCOUNTANT') && !isOwner && !isManager;

  // Granular Action Permissions
  const canCreate = isOwner || isManager;
  const canUpdate = isOwner || isManager;
  const canPriceUpdate = isOwner || isManager;
  const canStockUpdate = isOwner || isManager;
  const canDelete = isOwner;

  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [outlets, setOutlets] = useState<OutletItem[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Add Product Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addSku, setAddSku] = useState('');
  const [addBarcode, setAddBarcode] = useState('');
  const [addCategory, setAddCategory] = useState('General');
  const [addCostPrice, setAddCostPrice] = useState(0);
  const [addSellingPrice, setAddSellingPrice] = useState(0);
  const [addTaxRate, setAddTaxRate] = useState(5);
  const [addStockQty, setAddStockQty] = useState(0);
  const [addHsnCode, setAddHsnCode] = useState('');
  const [addAssignedOutletIds, setAddAssignedOutletIds] = useState<string[]>([]);
  const [addAssignedUserIds, setAddAssignedUserIds] = useState<string[]>([]);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit Product Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editCostPrice, setEditCostPrice] = useState(0);
  const [editSellingPrice, setEditSellingPrice] = useState(0);
  const [editTaxRate, setEditTaxRate] = useState(5);
  const [editAssignedOutletIds, setEditAssignedOutletIds] = useState<string[]>([]);
  const [editAssignedUserIds, setEditAssignedUserIds] = useState<string[]>([]);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Stock Adjustment Modal
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockProduct, setStockProduct] = useState<ProductRecord | null>(null);
  const [adjustmentQty, setAdjustmentQty] = useState(0);
  const [adjustmentReason, setAdjustmentReason] = useState('Stock Count Audit');
  const [isSubmittingStock, setIsSubmittingStock] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);

  // Status Notification
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const data = await apiRequest<ProductRecord[]>('/products');
      setProducts(data);
    } catch (err: any) {
      console.error('Failed to load products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAuxData = async () => {
    if (!isOwner && !isManager) return;
    try {
      const [outletsData, membersData] = await Promise.all([
        apiRequest<OutletItem[]>('/tenancy/outlets').catch(() => []),
        apiRequest<MemberItem[]>('/iam/members').catch(() => []),
      ]);
      setOutlets(outletsData || []);
      setMembers(membersData || []);
    } catch (err) {
      console.warn('Failed to load auxiliary access data:', err);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchAuxData();
  }, []);

  const categories = ['ALL', ...Array.from(new Set(products.map((p) => p.category)))];

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingAdd(true);
    setAddError(null);

    if (addAssignedOutletIds.length === 0 && addAssignedUserIds.length === 0) {
      setAddError('Please select at least one branch or cashier for this product.');
      setIsSubmittingAdd(false);
      return;
    }

    try {
      await apiRequest('/products', {
        method: 'POST',
        body: JSON.stringify({
          name: addName,
          sku: addSku,
          barcode: addBarcode || undefined,
          category: addCategory || 'General',
          costPrice: Number(addCostPrice),
          sellingPrice: Number(addSellingPrice),
          taxRate: Number(addTaxRate),
          hsnCode: addHsnCode || undefined,
          stockQty: canStockUpdate ? Number(addStockQty) : 0,
          assignedOutletIds: addAssignedOutletIds,
          assignedUserIds: addAssignedUserIds,
        }),
      });

      setIsAddModalOpen(false);
      setAddName('');
      setAddSku('');
      setAddBarcode('');
      setAddSellingPrice(0);
      setAddCostPrice(0);
      setAddStockQty(0);
      setAddAssignedOutletIds([]);
      setAddAssignedUserIds([]);
      setStatusMessage({ type: 'success', text: `${capabilities.terminology.itemLabel} created successfully!` });
      await fetchProducts();
    } catch (err: any) {
      setAddError(err.message || 'Failed to create product.');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const openEditModal = (product: ProductRecord) => {
    setEditingProduct(product);
    setEditName(product.name);
    setEditSku(product.sku);
    setEditBarcode(product.barcode || '');
    setEditCategory(product.category);
    setEditCostPrice(product.costPrice);
    setEditSellingPrice(product.sellingPrice);
    setEditTaxRate(product.taxRate);
    setEditAssignedOutletIds(product.assignedOutletIds || []);
    setEditAssignedUserIds(product.assignedUserIds || []);
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    setIsSubmittingEdit(true);
    setEditError(null);

    if (editAssignedOutletIds.length === 0 && editAssignedUserIds.length === 0) {
      setEditError('Please select at least one branch or cashier for this product.');
      setIsSubmittingEdit(false);
      return;
    }

    try {
      const payload: any = {
        name: editName,
        sku: editSku,
        barcode: editBarcode || null,
        category: editCategory,
        taxRate: Number(editTaxRate),
        assignedOutletIds: editAssignedOutletIds,
        assignedUserIds: editAssignedUserIds,
      };

      if (canPriceUpdate) {
        payload.sellingPrice = Number(editSellingPrice);
        payload.costPrice = Number(editCostPrice);
      }

      await apiRequest(`/products/${editingProduct.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setIsEditModalOpen(false);
      setStatusMessage({ type: 'success', text: `${capabilities.terminology.itemLabel} updated successfully.` });
      await fetchProducts();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update product.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const openStockModal = (product: ProductRecord) => {
    setStockProduct(product);
    setAdjustmentQty(0);
    setAdjustmentReason('Stock Count Audit');
    setStockError(null);
    setIsStockModalOpen(true);
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockProduct) return;

    setIsSubmittingStock(true);
    setStockError(null);

    try {
      await apiRequest(`/products/${stockProduct.id}/adjust-stock`, {
        method: 'POST',
        body: JSON.stringify({
          adjustmentQty: Number(adjustmentQty),
          reason: adjustmentReason,
          outletId: activeOutletId || undefined,
        }),
      });

      setIsStockModalOpen(false);
      setStatusMessage({ type: 'success', text: `Stock adjusted by ${adjustmentQty > 0 ? '+' : ''}${adjustmentQty} units.` });
      await fetchProducts();
    } catch (err: any) {
      setStockError(err.message || 'Failed to adjust stock.');
    } finally {
      setIsSubmittingStock(false);
    }
  };

  const handleDeleteProduct = async (product: ProductRecord) => {
    if (!confirm(`Are you sure you want to delete ${product.name}? If historical sales or purchase records exist, it will be safely archived.`)) {
      return;
    }

    try {
      const res = await apiRequest<any>(`/products/${product.id}`, {
        method: 'DELETE',
      });
      setStatusMessage({ type: res.archived ? 'info' : 'success', text: res.message || 'Product deleted.' });
      await fetchProducts();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to delete product.' });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Boxes className="w-5 h-5 text-brand-600" />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {capabilities.terminology.itemPluralLabel}
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            {capabilities.label} Catalog • Role-Enforced Product & Stock Management
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canCreate && (
            <Button
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setAddAssignedOutletIds([]);
                setAddAssignedUserIds([]);
                setIsAddModalOpen(true);
              }}
              className="shadow-lg shadow-brand-500/20"
            >
              {capabilities.terminology.catalogAction}
            </Button>
          )}
        </div>
      </div>

      {/* Status Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : statusMessage.type === 'info'
                ? 'bg-sky-950/40 border-sky-500/40 text-sky-300'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-slate-500 hover:text-slate-900 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, SKU, or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-brand-500 text-slate-900 font-bold'
                  : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <Card variant="glass" className="overflow-hidden p-0 border-slate-200 shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 min-w-[720px]">
            <thead className="bg-slate-50/90 text-slate-500 border-b border-slate-200 text-[11px] uppercase tracking-wider font-bold">
              <tr>
                <th className="py-3 px-4">Item & SKU</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Availability / Access</th>
                <th className="py-3 px-4 text-right">Selling Price</th>
                {!isCashier && <th className="py-3 px-4 text-right">Cost Price</th>}
                <th className="py-3 px-4 text-right">GST %</th>
                {capabilities.enabledModules.inventory && <th className="py-3 px-4 text-right">Stock Qty</th>}
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Loading catalog items...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 space-y-2">
                    <Package className="w-10 h-10 mx-auto stroke-1 text-slate-600" />
                    <p className="text-sm font-semibold text-slate-500">
                      {searchQuery ? 'No matching items found.' : capabilities.terminology.emptyCatalogText}
                    </p>
                    {canCreate && !searchQuery && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setIsAddModalOpen(true)}
                        leftIcon={<Plus className="w-3.5 h-3.5" />}
                        className="mt-2"
                      >
                        {capabilities.terminology.catalogAction}
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{p.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 font-mono text-[11px] text-slate-500">
                          <span>SKU: {p.sku}</span>
                          {p.barcode && <span>• Barcode: {p.barcode}</span>}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge variant="neutral" size="sm">
                        {p.category}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1 text-[11px]">
                        {p.assignedOutletIds && p.assignedOutletIds.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 font-medium">
                            <Store className="w-3 h-3 text-sky-600" />
                            {p.assignedOutletIds
                              .map((oid) => outlets.find((o) => o.id === oid)?.name || 'Branch')
                              .join(', ')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                            <Store className="w-3 h-3 text-emerald-600" /> All Branches
                          </span>
                        )}

                        {p.assignedUserIds && p.assignedUserIds.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                            <Users className="w-3 h-3 text-purple-600" />
                            {p.assignedUserIds
                              .map((uid) => {
                                const mem = members.find((m) => m.user.id === uid);
                                return mem ? `${mem.user.firstName} ${mem.user.lastName}` : 'Cashier';
                              })
                              .join(', ')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                            <Users className="w-3 h-3 text-emerald-600" /> All Cashiers
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right font-black text-brand-600 text-sm">
                      ₹{p.sellingPrice.toFixed(2)}
                    </td>

                    {!isCashier && (
                      <td className="py-3.5 px-4 text-right text-slate-500 font-mono">
                        ₹{p.costPrice.toFixed(2)}
                      </td>
                    )}

                    <td className="py-3.5 px-4 text-right">
                      <span className="font-mono text-slate-700">{p.taxRate}%</span>
                    </td>

                    {capabilities.enabledModules.inventory && (
                      <td className="py-3.5 px-4 text-right">
                        <Badge
                          variant={p.stockQty <= 5 ? 'danger' : p.stockQty <= 15 ? 'warning' : 'success'}
                          size="sm"
                        >
                          {p.stockQty} Units
                        </Badge>
                      </td>
                    )}

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canStockUpdate && capabilities.enabledModules.inventory && (
                          <button
                            onClick={() => openStockModal(p)}
                            title="Adjust Stock"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-brand-500 hover:text-slate-900 text-slate-700 transition-colors"
                          >
                            <ArrowUpDown className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {canUpdate && (
                          <button
                            onClick={() => openEditModal(p)}
                            title="Edit Details"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-sky-500 hover:text-slate-900 text-slate-700 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {canDelete && (
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            title="Delete or Archive"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-500 hover:text-white text-slate-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {!canUpdate && !canStockUpdate && !canDelete && (
                          <span className="text-[11px] text-slate-500 font-semibold italic">
                            Read Only
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Product Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={capabilities.terminology.catalogAction}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
          {addError && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs">
              {addError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Item Name *"
              required
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="e.g. Basmati Rice 5kg or Oil Change Service"
            />
            <Input
              label="SKU Code *"
              required
              value={addSku}
              onChange={(e) => setAddSku(e.target.value.toUpperCase())}
              placeholder="e.g. RICE-5KG"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Barcode / EAN"
              value={addBarcode}
              onChange={(e) => setAddBarcode(e.target.value)}
              placeholder="Scan or type barcode"
            />
            <Input
              label="Category"
              value={addCategory}
              onChange={(e) => setAddCategory(e.target.value)}
              placeholder="e.g. Grocery, Bakery, Service"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Selling Price (₹) *"
              type="number"
              step="0.01"
              required
              value={addSellingPrice}
              onChange={(e) => setAddSellingPrice(parseFloat(e.target.value) || 0)}
            />
            <Input
              label="Cost / Purchase Price (₹)"
              type="number"
              step="0.01"
              value={addCostPrice}
              onChange={(e) => setAddCostPrice(parseFloat(e.target.value) || 0)}
            />
            <Input
              label="Tax / GST Rate (%)"
              type="number"
              value={addTaxRate}
              onChange={(e) => setAddTaxRate(parseFloat(e.target.value) || 0)}
            />
          </div>

          {capabilities.enabledModules.inventory && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
              <Input
                label="Opening Stock Quantity"
                type="number"
                disabled={!canStockUpdate}
                value={addStockQty}
                onChange={(e) => setAddStockQty(parseFloat(e.target.value) || 0)}
                helperText={!canStockUpdate ? 'Requires stock_update permission' : 'Initial stock balance for current outlet'}
              />
              <Input
                label="HSN / SAC Code"
                value={addHsnCode}
                onChange={(e) => setAddHsnCode(e.target.value)}
                placeholder="e.g. 100630"
              />
            </div>
          )}

          {/* Product Availability / Assign Access */}
          {isOwner && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-600" />
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Product Availability / Assign Access
                </h3>
              </div>
              <p className="text-[11px] text-slate-500">
                Choose which branch(es) and cashier(s) can view and bill this product. Leaving options unchecked assigns org-wide access.
              </p>

              {/* Branches */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-slate-700 text-xs">Branch Access</span>
                  <span className="text-[11px] text-slate-500">
                    {addAssignedOutletIds.length === 0 ? 'All Branches' : `${addAssignedOutletIds.length} Selected`}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 bg-white rounded-lg border border-slate-200">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addAssignedOutletIds.length === 0}
                      onChange={() => setAddAssignedOutletIds([])}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="font-semibold text-slate-900">All Branches (Org-wide)</span>
                  </label>
                  {outlets.map((outlet) => {
                    const isChecked = addAssignedOutletIds.includes(outlet.id);
                    return (
                      <label key={outlet.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setAddAssignedOutletIds(addAssignedOutletIds.filter((id) => id !== outlet.id));
                            } else {
                              setAddAssignedOutletIds([...addAssignedOutletIds, outlet.id]);
                            }
                          }}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span>{outlet.name} ({outlet.code})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Cashiers */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-slate-700 text-xs">Cashier / Staff Access</span>
                  <span className="text-[11px] text-slate-500">
                    {addAssignedUserIds.length === 0 ? 'All Cashiers' : `${addAssignedUserIds.length} Selected`}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 bg-white rounded-lg border border-slate-200">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addAssignedUserIds.length === 0}
                      onChange={() => setAddAssignedUserIds([])}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="font-semibold text-slate-900">All Cashiers (Unrestricted)</span>
                  </label>
                  {members.map((m) => {
                    const isChecked = addAssignedUserIds.includes(m.user.id);
                    return (
                      <label key={m.membershipId} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setAddAssignedUserIds(addAssignedUserIds.filter((id) => id !== m.user.id));
                            } else {
                              setAddAssignedUserIds([...addAssignedUserIds, m.user.id]);
                            }
                          }}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span>{m.user.firstName} {m.user.lastName} ({m.primaryRole?.name || 'Staff'})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmittingAdd}>
              Save {capabilities.terminology.itemLabel}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Product Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit ${editingProduct?.name || 'Product'}`}
        maxWidth="lg"
      >
        <form onSubmit={handleUpdateProduct} className="space-y-4 text-xs">
          {editError && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs">
              {editError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Item Name *"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
            <Input
              label="SKU Code *"
              required
              value={editSku}
              onChange={(e) => setEditSku(e.target.value.toUpperCase())}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Barcode"
              value={editBarcode}
              onChange={(e) => setEditBarcode(e.target.value)}
            />
            <Input
              label="Category"
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-700">Selling Price (₹) *</span>
                {!canPriceUpdate && (
                  <span title="Locked without price_update permission">
                    <Lock className="w-3 h-3 text-amber-600" />
                  </span>
                )}
              </div>
              <Input
                type="number"
                step="0.01"
                disabled={!canPriceUpdate}
                value={editSellingPrice}
                onChange={(e) => setEditSellingPrice(parseFloat(e.target.value) || 0)}
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-700">Cost Price (₹)</span>
                {!canPriceUpdate && (
                  <span title="Locked without price_update permission">
                    <Lock className="w-3 h-3 text-amber-600" />
                  </span>
                )}
              </div>
              <Input
                type="number"
                step="0.01"
                disabled={!canPriceUpdate}
                value={editCostPrice}
                onChange={(e) => setEditCostPrice(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-700">Tax Rate (GST %)</span>
              </div>
              <Input
                type="number"
                value={editTaxRate}
                onChange={(e) => setEditTaxRate(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Product Availability / Assign Access */}
          {isOwner && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-brand-600" />
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Product Availability / Assign Access <span className="text-rose-500">*</span>
                  </h3>
                </div>
                <Badge
                  variant={editAssignedOutletIds.length > 0 || editAssignedUserIds.length > 0 ? 'brand' : 'danger'}
                  size="sm"
                >
                  {editAssignedOutletIds.length + editAssignedUserIds.length} Target(s) Selected
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500">
                Update which branch(es) and cashier(s) can view and sell this item. At least one branch or cashier is required.
              </p>

              {/* Branches */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-slate-700 text-xs">Branch Access ({editAssignedOutletIds.length}/{outlets.length})</span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setEditAssignedOutletIds(outlets.map((o) => o.id))}
                      className="text-brand-600 hover:underline font-semibold"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setEditAssignedOutletIds([])}
                      className="text-slate-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 bg-white rounded-lg border border-slate-200">
                  {outlets.map((outlet) => {
                    const isChecked = editAssignedOutletIds.includes(outlet.id);
                    return (
                      <label key={outlet.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-900">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setEditAssignedOutletIds(editAssignedOutletIds.filter((id) => id !== outlet.id));
                            } else {
                              setEditAssignedOutletIds([...editAssignedOutletIds, outlet.id]);
                            }
                          }}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span>{outlet.name} ({outlet.code})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Cashiers */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-slate-700 text-xs">Cashier / Staff Access ({editAssignedUserIds.length}/{members.length})</span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setEditAssignedUserIds(members.map((m) => m.user.id))}
                      className="text-brand-600 hover:underline font-semibold"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setEditAssignedUserIds([])}
                      className="text-slate-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 bg-white rounded-lg border border-slate-200">
                  {members.map((m) => {
                    const isChecked = editAssignedUserIds.includes(m.user.id);
                    return (
                      <label key={m.membershipId} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-900">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setEditAssignedUserIds(editAssignedUserIds.filter((id) => id !== m.user.id));
                            } else {
                              setEditAssignedUserIds([...editAssignedUserIds, m.user.id]);
                            }
                          }}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span>{m.user.firstName} {m.user.lastName} ({m.primaryRole?.name || 'Staff'})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {editAssignedOutletIds.length === 0 && editAssignedUserIds.length === 0 && (
                <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
                  ⚠️ Please select at least one branch or cashier for this product before saving.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmittingEdit}>
              Update {capabilities.terminology.itemLabel}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Adjust Stock Modal */}
      <Modal
        isOpen={isStockModalOpen}
        onClose={() => setIsStockModalOpen(false)}
        title={`Adjust Stock • ${stockProduct?.name}`}
        maxWidth="md"
      >
        <form onSubmit={handleAdjustStock} className="space-y-4 text-xs">
          {stockError && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs">
              {stockError}
            </div>
          )}

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center text-xs">
            <span className="text-slate-500">Current Stock Balance:</span>
            <span className="font-bold text-slate-900 text-sm">{stockProduct?.stockQty} Units</span>
          </div>

          <Input
            label="Adjustment Delta (+ or - units) *"
            type="number"
            required
            value={adjustmentQty}
            onChange={(e) => setAdjustmentQty(parseFloat(e.target.value) || 0)}
            helperText="e.g. +20 for restock, -5 for damage/shrinkage"
          />

          <Input
            label="Audit Reason *"
            required
            value={adjustmentReason}
            onChange={(e) => setAdjustmentReason(e.target.value)}
            placeholder="e.g. Physical inventory count correction"
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsStockModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmittingStock}>
              Commit Stock Adjustment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
