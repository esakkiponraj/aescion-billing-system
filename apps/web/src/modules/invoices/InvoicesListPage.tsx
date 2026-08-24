import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Plus,
  Search,
  Printer,
  Eye,
  RefreshCw,
  FileCheck,
  Building,
  User,
  ArrowUpRight,
  DollarSign,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { DocumentPrintModal, DocumentPrintData } from '../../components/common/DocumentPrintModal';
import { getSocket } from '../../services/socket';

export const InvoicesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, organizations } = useAuthStore();
  const { activeOrgId, activeOutletId, roles } = useTenantStore();

  const currentOrg = organizations.find((o) => o.organizationId === activeOrgId);
  const isOwner = roles.includes('OWNER') || roles.includes('MANAGER');

  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [cashierFilter, setCashierFilter] = useState('ALL');
  const [cashiers, setCashiers] = useState<{ id: string; name: string }[]>([]);

  // Print modal state
  const [printData, setPrintData] = useState<DocumentPrintData | null>(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter !== 'ALL') params.append('paymentStatus', statusFilter);
      if (cashierFilter !== 'ALL') params.append('cashierId', cashierFilter);
      if (activeOutletId) params.append('outletId', activeOutletId);

      const data = await apiRequest(`/finance/invoices?${params.toString()}`);
      setInvoices(data || []);

      if (isOwner && data) {
        const uniqueCashiers = new Map<string, string>();
        data.forEach((inv: any) => {
          if (inv.createdByUser) {
            const name = `${inv.createdByUser.firstName || ''} ${inv.createdByUser.lastName || ''}`.trim() || inv.createdByUser.email;
            uniqueCashiers.set(inv.createdByUser.id, name);
          }
        });
        setCashiers(Array.from(uniqueCashiers.entries()).map(([id, name]) => ({ id, name })));
      }
    } catch (err) {
      console.error('Failed to load invoices', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, cashierFilter, activeOutletId, isOwner]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Real-time updates via Socket.IO
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleUpdate = () => {
      fetchInvoices();
    };

    socket.on('invoice:created', handleUpdate);
    socket.on('invoice:updated', handleUpdate);
    socket.on('invoice:cancelled', handleUpdate);
    socket.on('receipt:generated', handleUpdate);

    return () => {
      socket.off('invoice:created', handleUpdate);
      socket.off('invoice:updated', handleUpdate);
      socket.off('invoice:cancelled', handleUpdate);
      socket.off('receipt:generated', handleUpdate);
    };
  }, [fetchInvoices]);

  const handlePrint = (inv: any) => {
    setPrintData({
      type: 'INVOICE',
      title: 'Tax Invoice',
      documentNumber: inv.invoiceNumber,
      date: new Date(inv.createdAt).toLocaleDateString(),
      dueDate: inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : undefined,
      status: inv.paymentStatus,
      businessName: currentOrg?.organizationName || 'Business',
      businessAddress: undefined,
      outletName: inv.outlet?.name,
      customerName: inv.customer?.name || 'Walk-in Customer',
      customerPhone: inv.customer?.phone || undefined,
      customerEmail: inv.customer?.email || undefined,
      customerAddress: inv.customer?.billingAddress || undefined,
      items: inv.items?.map((it: any) => ({
        description: it.description,
        sku: it.product?.sku,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discountAmount: it.discountAmount,
        taxRate: it.taxRate,
        totalAmount: it.totalAmount,
      })),
      subtotal: inv.subtotal,
      discountAmount: inv.discountAmount,
      taxableAmount: inv.taxableAmount,
      cgstAmount: inv.cgstAmount,
      sgstAmount: inv.sgstAmount,
      additionalCharges: inv.additionalCharges,
      totalAmount: inv.totalAmount,
      paidAmount: inv.paidAmount,
      outstandingAmount: inv.outstandingAmount,
      termsAndConditions: inv.termsAndConditions,
      notes: inv.notes,
      createdByName: inv.createdByUser
        ? `${inv.createdByUser.firstName || ''} ${inv.createdByUser.lastName || ''}`.trim()
        : undefined,
    });
    setIsPrintOpen(true);
  };

  // Metrics
  const validInvoices = invoices.filter((i) => i.paymentStatus !== 'CANCELLED');
  const totalInvoiced = validInvoices.reduce((acc, i) => acc + (i.totalAmount || 0), 0);
  const totalPaid = validInvoices.reduce((acc, i) => acc + (i.paidAmount || 0), 0);
  const totalOutstanding = validInvoices.reduce((acc, i) => acc + (i.outstandingAmount || 0), 0);

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Invoices</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Complete GST-compliant sales invoices linked with normal POS and quotation conversions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchInvoices()}
            className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => navigate('/invoices/new')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Invoice
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Invoices</p>
          <p className="text-xl font-black text-slate-900 mt-1 font-mono">{invoices.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Invoiced</p>
          <p className="text-xl font-black text-slate-900 mt-1 font-mono text-brand-700">₹{totalInvoiced.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Collected</p>
          <p className="text-xl font-black text-emerald-600 mt-1 font-mono">₹{totalPaid.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Outstanding Balance</p>
          <p className={`text-xl font-black font-mono mt-1 ${totalOutstanding > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
            ₹{totalOutstanding.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice #, customer name, phone..."
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
            { id: 'PAID', label: 'Paid' },
            { id: 'PARTIALLY_PAID', label: 'Partially Paid' },
            { id: 'UNPAID', label: 'Unpaid' },
            { id: 'OVERDUE', label: 'Overdue' },
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

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
            <p className="text-xs font-semibold">Loading invoices...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">No invoices found</p>
            <p className="text-xs text-slate-500 mt-1">
              {search || statusFilter !== 'ALL'
                ? 'Try adjusting your search filters.'
                : 'Invoices created via Billing POS or converted quotations will appear here.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Branch</th>
                  {isOwner && <th className="py-3 px-4">Prepared By</th>}
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-right">Paid Amount</th>
                  <th className="py-3 px-4 text-right">Balance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => {
                  const statusColors: Record<string, string> = {
                    PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    PARTIALLY_PAID: 'bg-blue-50 text-blue-700 border-blue-200',
                    UNPAID: 'bg-amber-50 text-amber-700 border-amber-200',
                    OVERDUE: 'bg-rose-50 text-rose-700 border-rose-200',
                    CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
                  };

                  return (
                    <tr
                      key={inv.id}
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 font-mono group-hover:text-brand-600 transition-colors">
                          {inv.invoiceNumber}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                          <span>{new Date(inv.createdAt).toLocaleDateString()}</span>
                          {inv.quotation && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[9px] font-bold">
                              From {inv.quotation.quotationNumber}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">
                          {inv.customer?.name || 'Walk-in Customer'}
                        </div>
                        {inv.customer?.phone && (
                          <div className="text-[11px] text-slate-400">{inv.customer.phone}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-slate-600">{inv.outlet?.name || 'Main Branch'}</span>
                      </td>
                      {isOwner && (
                        <td className="py-3.5 px-4">
                          <span className="text-slate-600">
                            {inv.createdByUser
                              ? `${inv.createdByUser.firstName || ''} ${inv.createdByUser.lastName || ''}`.trim() || inv.createdByUser.email
                              : 'Counter POS'}
                          </span>
                        </td>
                      )}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        ₹{(inv.totalAmount || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-emerald-600 font-semibold">
                        ₹{(inv.paidAmount || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold">
                        <span className={inv.outstandingAmount > 0 ? 'text-amber-700' : 'text-slate-400'}>
                          ₹{(inv.outstandingAmount || 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${
                            statusColors[inv.paymentStatus] || 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {inv.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/invoices/${inv.id}`)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="View Detail"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePrint(inv)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Print Tax Invoice"
                          >
                            <Printer className="w-4 h-4" />
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
