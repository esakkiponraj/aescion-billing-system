import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Search,
  Printer,
  Eye,
  RefreshCw,
  CreditCard,
  Building,
  User,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { DocumentPrintModal, DocumentPrintData } from '../../components/common/DocumentPrintModal';
import { getSocket } from '../../services/socket';
import { useDebounce } from '../../hooks/useDebounce';

export const ReceiptsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, organizations } = useAuthStore();
  const { activeOrgId, activeOutletId, roles } = useTenantStore();

  const currentOrg = organizations.find((o) => o.organizationId === activeOrgId);
  const isOwner = roles.includes('OWNER') || roles.includes('MANAGER');

  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL');
  const [cashierFilter, setCashierFilter] = useState('ALL');
  const [cashiers, setCashiers] = useState<{ id: string; name: string }[]>([]);

  // Print modal state
  const [printData, setPrintData] = useState<DocumentPrintData | null>(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  const fetchReceipts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (paymentMethodFilter !== 'ALL') params.append('paymentMethod', paymentMethodFilter);
      if (cashierFilter !== 'ALL') params.append('cashierId', cashierFilter);
      if (activeOutletId) params.append('outletId', activeOutletId);

      const data = await apiRequest(`/finance/receipts?${params.toString()}`);
      setReceipts(data || []);

      if (isOwner && data) {
        const uniqueCashiers = new Map<string, string>();
        data.forEach((r: any) => {
          if (r.createdByUser) {
            const name = `${r.createdByUser.firstName || ''} ${r.createdByUser.lastName || ''}`.trim() || r.createdByUser.email;
            uniqueCashiers.set(r.createdByUser.id, name);
          }
        });
        setCashiers(Array.from(uniqueCashiers.entries()).map(([id, name]) => ({ id, name })));
      }
    } catch (err) {
      console.error('Failed to load receipts', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, paymentMethodFilter, cashierFilter, activeOutletId, isOwner]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  // Real-time updates via Socket.IO
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleUpdate = () => {
      fetchReceipts();
    };

    socket.on('receipt:generated', handleUpdate);
    socket.on('receipt:voided', handleUpdate);

    return () => {
      socket.off('receipt:generated', handleUpdate);
      socket.off('receipt:voided', handleUpdate);
    };
  }, [fetchReceipts]);

  const handlePrint = (r: any) => {
    setPrintData({
      type: 'RECEIPT',
      title: 'Payment Receipt',
      documentNumber: r.receiptNumber,
      date: new Date(r.paymentDate || r.createdAt).toLocaleDateString(),
      status: r.status,
      businessName: currentOrg?.organizationName || 'Business',
      businessAddress: undefined,
      outletName: r.outlet?.name,
      customerName: r.customer?.name || 'Walk-in Customer',
      customerPhone: r.customer?.phone || undefined,
      customerEmail: r.customer?.email || undefined,
      customerAddress: r.customer?.billingAddress || undefined,
      totalAmount: r.amountPaid,
      paidAmount: r.totalPaid,
      outstandingAmount: r.remainingBalance,
      paymentMethod: r.paymentMethod,
      referenceNumber: r.referenceNumber || undefined,
      notes: r.notes || (r.invoice ? `Payment for Invoice ${r.invoice.invoiceNumber}` : undefined),
      createdByName: r.createdByUser
        ? `${r.createdByUser.firstName || ''} ${r.createdByUser.lastName || ''}`.trim()
        : undefined,
    });
    setIsPrintOpen(true);
  };

  // Metrics
  const validReceipts = receipts.filter((r) => r.status !== 'VOIDED');
  const totalCollected = validReceipts.reduce((acc, r) => acc + (r.amountPaid || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const todayCollected = validReceipts
    .filter((r) => new Date(r.paymentDate || r.createdAt).toISOString().slice(0, 10) === today)
    .reduce((acc, r) => acc + (r.amountPaid || 0), 0);

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Payment Receipts</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Audit-ready records of all payments collected with concurrency-safe RCP-YYYY-XXXX numbering.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchReceipts()}
            className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Receipts Issued</p>
          <p className="text-xl font-black text-slate-900 mt-1 font-mono">{validReceipts.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Collected</p>
          <p className="text-xl font-black text-emerald-600 mt-1 font-mono">₹{totalCollected.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Today's Collections</p>
          <p className="text-xl font-black text-brand-700 mt-1 font-mono">₹{todayCollected.toFixed(2)}</p>
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
              placeholder="Search receipt #, invoice #, customer, reference..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Payment Method Filter */}
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="ALL">All Methods</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CHEQUE">Cheque</option>
            </select>

            {/* Cashier Filter (if Owner/Manager) */}
            {isOwner && cashiers.length > 0 && (
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
            )}
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 text-xs">
          {[
            { id: 'ALL', label: 'All Receipts' },
            { id: 'ISSUED', label: 'Valid / Issued' },
            { id: 'VOIDED', label: 'Voided' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
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

      {/* Receipts Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
            <p className="text-xs font-semibold">Loading payment receipts...</p>
          </div>
        ) : receipts.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">No payment receipts found</p>
            <p className="text-xs text-slate-500 mt-1">
              Receipts generated from billing sales and invoice settlements will be listed here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Linked Invoice</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Method & Ref</th>
                  {isOwner && <th className="py-3 px-4">Cashier</th>}
                  <th className="py-3 px-4 text-right">Amount Paid</th>
                  <th className="py-3 px-4 text-right">Remaining Balance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receipts.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/receipts/${r.id}`)}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 font-mono group-hover:text-brand-600 transition-colors">
                        {r.receiptNumber}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(r.paymentDate || r.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-semibold text-slate-800">
                        {r.invoice?.invoiceNumber || '—'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">
                        {r.customer?.name || 'Walk-in Customer'}
                      </div>
                      {r.customer?.phone && (
                        <div className="text-[11px] text-slate-400">{r.customer.phone}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{r.paymentMethod}</div>
                      {r.referenceNumber && (
                        <div className="text-[11px] text-slate-400 font-mono">Ref: {r.referenceNumber}</div>
                      )}
                    </td>
                    {isOwner && (
                      <td className="py-3.5 px-4">
                        <span className="text-slate-600">
                          {r.createdByUser
                            ? `${r.createdByUser.firstName || ''} ${r.createdByUser.lastName || ''}`.trim() || r.createdByUser.email
                            : 'Staff'}
                        </span>
                      </td>
                    )}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 text-sm">
                      ₹{r.amountPaid.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-600">
                      ₹{(r.remainingBalance || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                          r.status === 'VOIDED'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/receipts/${r.id}`)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="View Receipt"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handlePrint(r)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Print Receipt"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
