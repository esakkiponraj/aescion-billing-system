import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  Printer,
  Copy,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Eye,
  Building,
  User,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { DocumentPrintModal, DocumentPrintData } from '../../components/common/DocumentPrintModal';
import { getSocket } from '../../services/socket';
import { useDebounce } from '../../hooks/useDebounce';

export const QuotationsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, organizations } = useAuthStore();
  const { activeOrgId, activeOutletId, roles } = useTenantStore();

  const currentOrg = organizations.find((o) => o.organizationId === activeOrgId);
  const isOwner = roles.includes('OWNER') || roles.includes('MANAGER');

  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [cashierFilter, setCashierFilter] = useState('ALL');
  const [cashiers, setCashiers] = useState<{ id: string; name: string }[]>([]);

  // Print modal state
  const [printData, setPrintData] = useState<DocumentPrintData | null>(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  const fetchQuotations = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (cashierFilter !== 'ALL') params.append('cashierId', cashierFilter);
      if (activeOutletId) params.append('outletId', activeOutletId);

      const data = await apiRequest(`/finance/quotations?${params.toString()}`);
      setQuotations(data || []);

      // Extract unique cashiers for filter dropdown
      if (isOwner && data) {
        const uniqueCashiers = new Map<string, string>();
        data.forEach((q: any) => {
          if (q.createdByUser) {
            const name = `${q.createdByUser.firstName || ''} ${q.createdByUser.lastName || ''}`.trim() || q.createdByUser.email;
            uniqueCashiers.set(q.createdByUser.id, name);
          }
        });
        setCashiers(Array.from(uniqueCashiers.entries()).map(([id, name]) => ({ id, name })));
      }
    } catch (err) {
      console.error('Failed to load quotations', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, cashierFilter, activeOutletId, isOwner]);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  // Real-time updates via Socket.IO
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleUpdate = () => {
      fetchQuotations();
    };

    socket.on('quotation:created', handleUpdate);
    socket.on('quotation:updated', handleUpdate);
    socket.on('quotation:converted', handleUpdate);

    return () => {
      socket.off('quotation:created', handleUpdate);
      socket.off('quotation:updated', handleUpdate);
      socket.off('quotation:converted', handleUpdate);
    };
  }, [fetchQuotations]);

  const handleDuplicate = async (id: string) => {
    try {
      const duplicated = await apiRequest(`/finance/quotations/${id}/duplicate`, {
        method: 'POST',
      });
      navigate(`/quotations/${duplicated.id}`);
    } catch (err: any) {
      alert(err.message || 'Failed to duplicate quotation');
    }
  };

  const handlePrint = (q: any) => {
    setPrintData({
      type: 'QUOTATION',
      title: 'Quotation / Estimate',
      documentNumber: q.quotationNumber,
      date: new Date(q.quotationDate || q.createdAt).toLocaleDateString(),
      dueDate: q.validUntil ? new Date(q.validUntil).toLocaleDateString() : undefined,
      status: q.status,
      businessName: currentOrg?.organizationName || 'Business',
      businessAddress: undefined,
      outletName: q.outlet?.name,
      customerName: q.customer?.name || 'General Customer',
      customerPhone: q.customer?.phone || undefined,
      customerEmail: q.customer?.email || undefined,
      customerAddress: q.customer?.billingAddress || undefined,
      items: q.items?.map((it: any) => ({
        description: it.description || it.productName || 'Item',
        sku: it.sku,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discountAmount: it.discountAmount,
        taxRate: it.taxRate,
        totalAmount: it.totalAmount,
      })),
      subtotal: q.subtotal,
      discountAmount: q.discountAmount,
      discountPercent: q.discountPercent,
      taxableAmount: q.taxableAmount,
      cgstAmount: q.cgstAmount,
      sgstAmount: q.sgstAmount,
      additionalCharges: q.additionalCharges,
      totalAmount: q.totalAmount,
      termsAndConditions: q.termsAndConditions,
      notes: q.notes,
      createdByName: q.createdByUser
        ? `${q.createdByUser.firstName || ''} ${q.createdByUser.lastName || ''}`.trim()
        : undefined,
    });
    setIsPrintOpen(true);
  };

  // Metrics calculation
  const totalValue = quotations.reduce((acc, q) => acc + (q.totalAmount || 0), 0);
  const acceptedCount = quotations.filter((q) => q.status === 'ACCEPTED').length;
  const pendingCount = quotations.filter((q) => q.status === 'DRAFT' || q.status === 'SENT').length;

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Quotations</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Create, manage, and convert commercial quotations without impacting stock until invoiced.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchQuotations()}
            className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => navigate('/quotations/new')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Quotation
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Quotations</p>
          <p className="text-xl font-black text-slate-900 mt-1 font-mono">{quotations.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Value</p>
          <p className="text-xl font-black text-slate-900 mt-1 font-mono text-brand-700">₹{totalValue.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Accepted</p>
          <p className="text-xl font-black text-emerald-600 mt-1 font-mono">{acceptedCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending / Draft</p>
          <p className="text-xl font-black text-amber-600 mt-1 font-mono">{pendingCount}</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search quotation #, customer name, phone..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>

          {/* Cashier Filter (if Owner/Manager) */}
          {isOwner && cashiers.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Cashier:</span>
              <select
                value={cashierFilter}
                onChange={(e) => setCashierFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="ALL">All Cashiers</option>
                {cashiers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'DRAFT', label: 'Draft' },
            { id: 'SENT', label: 'Sent' },
            { id: 'ACCEPTED', label: 'Accepted' },
            { id: 'CONVERTED', label: 'Converted to Invoice' },
            { id: 'REJECTED', label: 'Rejected' },
            { id: 'CANCELLED', label: 'Cancelled' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
                statusFilter === st.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quotations Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
            <p className="text-xs font-semibold">Loading quotations...</p>
          </div>
        ) : quotations.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">No quotations found</p>
            <p className="text-xs text-slate-500 mt-1">
              {search || statusFilter !== 'ALL'
                ? 'Try adjusting your search filters.'
                : 'Create your first commercial quotation to send to customers.'}
            </p>
            <button
              onClick={() => navigate('/quotations/new')}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Quotation
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Quotation #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Branch / Outlet</th>
                  {isOwner && <th className="py-3 px-4">Prepared By</th>}
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotations.map((q) => {
                  const statusColors: Record<string, string> = {
                    DRAFT: 'bg-amber-50 text-amber-700 border-amber-200',
                    SENT: 'bg-blue-50 text-blue-700 border-blue-200',
                    ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    CONVERTED: 'bg-purple-50 text-purple-700 border-purple-200',
                    REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
                    EXPIRED: 'bg-slate-100 text-slate-600 border-slate-200',
                    CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
                  };

                  return (
                    <tr
                      key={q.id}
                      onClick={() => navigate(`/quotations/${q.id}`)}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 font-mono group-hover:text-brand-600 transition-colors">
                          {q.quotationNumber}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(q.quotationDate || q.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">
                          {q.customer?.name || 'General Customer'}
                        </div>
                        {q.customer?.phone && (
                          <div className="text-[11px] text-slate-400">{q.customer.phone}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-slate-600">{q.outlet?.name || 'Main Branch'}</span>
                      </td>
                      {isOwner && (
                        <td className="py-3.5 px-4">
                          <span className="text-slate-600">
                            {q.createdByUser
                              ? `${q.createdByUser.firstName || ''} ${q.createdByUser.lastName || ''}`.trim() || q.createdByUser.email
                              : 'Staff'}
                          </span>
                        </td>
                      )}
                      <td className="py-3.5 px-4 text-slate-600 font-mono">
                        {q.items?.length || 0} item{q.items?.length === 1 ? '' : 's'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        ₹{(q.totalAmount || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${
                            statusColors[q.status] || 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {q.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/quotations/${q.id}`)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="View Detail"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePrint(q)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Print Quotation"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDuplicate(q.id)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Duplicate"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Document Print Modal */}
      <DocumentPrintModal
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        data={printData}
      />
    </div>
  );
};
