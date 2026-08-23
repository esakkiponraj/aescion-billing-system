import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileText,
  CreditCard,
  Download,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Building,
  Users,
  Search,
  Filter,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  Eye,
  RefreshCw,
  Zap,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Percent,
  Receipt,
  Wallet,
  Landmark,
  BookOpen,
  ArrowDownLeft,
  ArrowLeftRight,
  Printer,
  ShoppingBag,
  Sliders,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Table } from '../../components/common/Table';
import { apiRequest } from '../../services/api';
import { useTenantStore } from '../../stores/tenantStore';

export const AccountantDashboard: React.FC = () => {
  const { activeOrgName, activeOutletId, activeOutletName } = useTenantStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'dashboard';

  // Global State
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [salesInvoices, setSalesInvoices] = useState<any[]>([]);
  const [purchaseBills, setPurchaseBills] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [receivablesData, setReceivablesData] = useState<any>({ buckets: {}, items: [] });
  const [payablesData, setPayablesData] = useState<any>({ buckets: {}, items: [] });
  const [expenses, setExpenses] = useState<any[]>([]);
  const [cashBankData, setCashBankData] = useState<any>({ sessions: [], digitalPayments: [], cashPayments: [] });
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [selectedLedgerType, setSelectedLedgerType] = useState<'sales' | 'purchase' | 'expense' | 'customer'>('sales');
  const [taxData, setTaxData] = useState<any>({ summary: {}, rateBreakdown: [] });

  // Filters
  const [filterPeriod, setFilterPeriod] = useState('this_month');
  const [filterOutlet, setFilterOutlet] = useState('ALL');
  const [searchInvoice, setSearchInvoice] = useState('');
  const [filterInvoiceStatus, setFilterInvoiceStatus] = useState('ALL');
  const [searchBill, setSearchBill] = useState('');
  const [filterBillStatus, setFilterBillStatus] = useState('ALL');

  // Modals
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [selectedBill, setSelectedBill] = useState<any | null>(null);

  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState('ELECTRICITY');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseTax, setExpenseTax] = useState<number>(0);
  const [expenseMethod, setExpenseMethod] = useState('UPI');
  const [expenseVendor, setExpenseVendor] = useState('');

  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<'CUSTOMER_RECEIPT' | 'SUPPLIER_PAYMENT'>('CUSTOMER_RECEIPT');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [paymentRefNumber, setPaymentRefNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [targetInvoiceId, setTargetInvoiceId] = useState('');
  const [targetBillId, setTargetBillId] = useState('');

  const loadTabData = async () => {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams();
      if (filterOutlet !== 'ALL') queryParams.append('outletId', filterOutlet);

      if (activeTab === 'dashboard') {
        const res = await apiRequest<any>(`/finance/dashboard?${queryParams.toString()}`);
        setDashboardData(res);
      } else if (activeTab === 'sales-invoices') {
        const res = await apiRequest<any[]>(`/finance/sales-invoices?${queryParams.toString()}`);
        setSalesInvoices(res);
      } else if (activeTab === 'purchase-bills') {
        const res = await apiRequest<any[]>(`/finance/purchase-bills?${queryParams.toString()}`);
        setPurchaseBills(res);
      } else if (activeTab === 'payments') {
        const res = await apiRequest<any[]>(`/finance/payments?${queryParams.toString()}`);
        setPayments(res);
      } else if (activeTab === 'receivables') {
        const res = await apiRequest<any>(`/finance/receivables?${queryParams.toString()}`);
        setReceivablesData(res);
      } else if (activeTab === 'payables') {
        const res = await apiRequest<any>(`/finance/payables?${queryParams.toString()}`);
        setPayablesData(res);
      } else if (activeTab === 'expenses') {
        const res = await apiRequest<any[]>(`/finance/expenses?${queryParams.toString()}`);
        setExpenses(res);
      } else if (activeTab === 'cash-bank') {
        const res = await apiRequest<any>(`/finance/cash-bank?${queryParams.toString()}`);
        setCashBankData(res);
      } else if (activeTab === 'ledger') {
        const res = await apiRequest<any[]>(`/finance/ledgers?ledgerType=${selectedLedgerType}&${queryParams.toString()}`);
        setLedgerEntries(res);
      } else if (activeTab === 'gst-tax') {
        const res = await apiRequest<any>(`/finance/tax-summary?${queryParams.toString()}`);
        setTaxData(res);
      } else if (activeTab === 'reports' || activeTab === 'export') {
        const res = await apiRequest<any>(`/finance/dashboard?${queryParams.toString()}`);
        setDashboardData(res);
      }
    } catch (e) {
      console.error('Failed to load finance tab data', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTabData();
  }, [activeTab, filterOutlet, selectedLedgerType]);

  const switchTab = (tab: string) => {
    setSearchParams({ tab });
  };

  // Record Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/finance/payments', {
        method: 'POST',
        body: JSON.stringify({
          type: paymentType,
          amount: Number(paymentAmount),
          paymentMethod,
          referenceNumber: paymentRefNumber,
          notes: paymentNotes,
          invoiceId: paymentType === 'CUSTOMER_RECEIPT' ? targetInvoiceId || undefined : undefined,
          purchaseBillId: paymentType === 'SUPPLIER_PAYMENT' ? targetBillId || undefined : undefined,
        }),
      });
      setIsRecordPaymentModalOpen(false);
      setPaymentAmount(0);
      setPaymentRefNumber('');
      setPaymentNotes('');
      setTargetInvoiceId('');
      setTargetBillId('');
      alert('Payment record saved successfully and balances updated!');
      loadTabData();
    } catch (err: any) {
      alert(err.message || 'Failed to record payment.');
    }
  };

  // Add Expense
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/finance/expenses', {
        method: 'POST',
        body: JSON.stringify({
          category: expenseCategory,
          description: expenseDescription,
          amount: Number(expenseAmount),
          taxAmount: Number(expenseTax),
          paymentMethod: expenseMethod,
          vendorName: expenseVendor,
        }),
      });
      setIsAddExpenseModalOpen(false);
      setExpenseDescription('');
      setExpenseAmount(0);
      setExpenseTax(0);
      setExpenseVendor('');
      alert('Business expense saved and added to ledger!');
      loadTabData();
    } catch (err: any) {
      alert(err.message || 'Failed to create expense.');
    }
  };

  // CSV Export utility
  const exportToCsv = (filename: string, rows: any[]) => {
    if (!rows || rows.length === 0) {
      alert('No data available to export.');
      return;
    }
    const headers = Object.keys(rows[0]).join(',');
    const csvContent = [headers, ...rows.map((r) => Object.values(r).map((v) => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered lists
  const filteredSalesInvoices = salesInvoices.filter((inv) => {
    const matchesSearch = inv.invoiceNumber.toLowerCase().includes(searchInvoice.toLowerCase()) ||
      (inv.customer?.name || '').toLowerCase().includes(searchInvoice.toLowerCase());
    const matchesStatus = filterInvoiceStatus === 'ALL' || inv.paymentStatus === filterInvoiceStatus;
    return matchesSearch && matchesStatus;
  });

  const filteredPurchaseBills = purchaseBills.filter((b) => {
    const matchesSearch = b.billNumber.toLowerCase().includes(searchBill.toLowerCase()) ||
      (b.supplier?.name || '').toLowerCase().includes(searchBill.toLowerCase());
    const matchesStatus = filterBillStatus === 'ALL' || b.paymentStatus === filterBillStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Financial Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl glass-panel border-amber-200 bg-gradient-to-r from-amber-950/40 via-obsidian-900/60 to-obsidian-950 shadow-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-amber-600">
              Finance & Accounting • {activeOrgName}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {activeTab === 'dashboard' && 'Financial Overview & KPIs'}
            {activeTab === 'sales-invoices' && 'Sales Invoices & Revenue Ledger'}
            {activeTab === 'purchase-bills' && 'Supplier Purchase Bills & Payables'}
            {activeTab === 'payments' && 'Payments & Receipts Transaction Desk'}
            {activeTab === 'receivables' && 'Accounts Receivable & Aging Analysis'}
            {activeTab === 'payables' && 'Accounts Payable & Vendor Aging'}
            {activeTab === 'expenses' && 'Operational Expenses Ledger'}
            {activeTab === 'cash-bank' && 'Cash Register & Bank Account Activity'}
            {activeTab === 'ledger' && 'Transaction-Derived Financial Sub-Ledger'}
            {activeTab === 'gst-tax' && 'GST Compliance & Tax Position'}
            {activeTab === 'reports' && 'Financial Statements & P&L Analysis'}
            {activeTab === 'export' && 'Authorized Financial Data Export Pipeline'}
          </h1>
          <p className="text-xs text-slate-500">
            Real-time financial reconciliation, tax summaries, aging schedules, and expense audits.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="warning" size="md">
            Supermarket Accountant
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={loadTabData}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. DASHBOARD TAB */}
      {/* ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Top Finance KPI Cards */}
          {dashboardData && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card variant="glass" className="p-5 space-y-1">
                <span className="text-xs font-semibold text-slate-500 uppercase">Total Sales Revenue</span>
                <p className="text-3xl font-black text-slate-900">₹{dashboardData.kpis.totalSales.toLocaleString()}</p>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Gross Margin: ₹{dashboardData.kpis.grossProfit.toLocaleString()}</span>
                </div>
              </Card>

              <Card variant="glass" className="p-5 space-y-1">
                <span className="text-xs font-semibold text-slate-500 uppercase">Total Purchases</span>
                <p className="text-3xl font-black text-sky-600">₹{dashboardData.kpis.totalPurchases.toLocaleString()}</p>
                <p className="text-xs text-slate-500">Supplier inventory receipts</p>
              </Card>

              <Card variant="glass" className="p-5 space-y-1">
                <span className="text-xs font-semibold text-slate-500 uppercase">Accounts Receivable</span>
                <p className="text-3xl font-black text-amber-600">₹{dashboardData.kpis.customerReceivables.toLocaleString()}</p>
                <p className="text-xs text-amber-300/80">{dashboardData.kpis.overdueInvoices} Overdue Invoices</p>
              </Card>

              <Card variant="glass" className="p-5 space-y-1">
                <span className="text-xs font-semibold text-slate-500 uppercase">Accounts Payable</span>
                <p className="text-3xl font-black text-rose-600">₹{dashboardData.kpis.supplierPayables.toLocaleString()}</p>
                <p className="text-xs text-slate-500">Pending supplier payouts</p>
              </Card>
            </div>
          )}

          {/* Second Row: Cash/Bank & Tax Position */}
          {dashboardData && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card variant="solid" className="p-4 border-slate-200 space-y-1">
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-yellow-400" /> Cash Balance
                </span>
                <p className="text-2xl font-bold text-slate-900">₹{dashboardData.kpis.cashBalance.toLocaleString()}</p>
                <p className="text-[11px] text-slate-500">Till float & cash receipts</p>
              </Card>

              <Card variant="solid" className="p-4 border-slate-200 space-y-1">
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-sky-600" /> Bank & Digital
                </span>
                <p className="text-2xl font-bold text-slate-900">₹{dashboardData.kpis.bankBalance.toLocaleString()}</p>
                <p className="text-[11px] text-slate-500">UPI, Card, Bank transfers</p>
              </Card>

              <Card variant="solid" className="p-4 border-slate-200 space-y-1">
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-600" /> Operating Expenses
                </span>
                <p className="text-2xl font-bold text-amber-300">₹{dashboardData.kpis.totalExpenses.toLocaleString()}</p>
                <p className="text-[11px] text-slate-500">Rent, power, maintenance</p>
              </Card>

              <Card variant="solid" className="p-4 border-slate-200 space-y-1">
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-purple-600" /> Net GST Position
                </span>
                <p className="text-2xl font-bold text-purple-300">₹{dashboardData.kpis.netGstPayable.toFixed(2)}</p>
                <p className="text-[11px] text-slate-500">Output ₹{dashboardData.kpis.outputGst.toFixed(0)} - Input ₹{dashboardData.kpis.inputGst.toFixed(0)}</p>
              </Card>
            </div>
          )}

          {/* Attention Required: Upcoming Supplier Payments & Overdue Receivables */}
          {dashboardData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Upcoming Supplier Payments */}
              <Card variant="solid" className="p-6 border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-rose-600" /> Upcoming Supplier Payments
                  </h3>
                  <button
                    onClick={() => switchTab('payables')}
                    className="text-xs text-amber-600 hover:underline flex items-center gap-1"
                  >
                    All Payables <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-2">
                  {dashboardData.upcomingSupplierPayments?.length === 0 ? (
                    <p className="text-xs text-slate-500 py-3 text-center">No pending supplier bills due.</p>
                  ) : (
                    dashboardData.upcomingSupplierPayments?.map((b: any) => (
                      <div
                        key={b.id}
                        className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-900">{b.supplierName}</p>
                          <p className="text-[11px] text-slate-500 font-mono">Bill #{b.billNumber}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-rose-600">₹{b.outstandingAmount.toLocaleString()}</p>
                          <span className={`text-[10px] font-semibold ${b.daysRemaining < 0 ? 'text-rose-500' : 'text-amber-600'}`}>
                            {b.daysRemaining < 0 ? `${Math.abs(b.daysRemaining)} days overdue` : `Due in ${b.daysRemaining} days`}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              {/* Overdue Receivables Alert */}
              <Card variant="solid" className="p-6 border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" /> Customer Receivables Alert
                  </h3>
                  <button
                    onClick={() => switchTab('receivables')}
                    className="text-xs text-amber-600 hover:underline flex items-center gap-1"
                  >
                    All Receivables <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-2">
                  {dashboardData.receivableAlerts?.length === 0 ? (
                    <p className="text-xs text-slate-500 py-3 text-center">All customer credit accounts in good standing.</p>
                  ) : (
                    dashboardData.receivableAlerts?.map((inv: any) => (
                      <div
                        key={inv.id}
                        className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-900">{inv.customerName}</p>
                          <p className="text-[11px] text-slate-500 font-mono">Inv #{inv.invoiceNumber}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-amber-600">₹{inv.outstandingAmount.toLocaleString()}</p>
                          <span className="text-[10px] font-semibold text-rose-600">
                            {inv.daysOverdue} days overdue
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SALES INVOICES TAB */}
      {/* ========================================================================= */}
      {activeTab === 'sales-invoices' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl glass-panel border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex-1 w-full md:w-auto relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by invoice number or customer name..."
                value={searchInvoice}
                onChange={(e) => setSearchInvoice(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <Select
                value={filterInvoiceStatus}
                onChange={(e) => setFilterInvoiceStatus(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Payment Statuses' },
                  { value: 'PAID', label: 'Paid' },
                  { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
                  { value: 'UNPAID', label: 'Unpaid' },
                ]}
              />

              <Button
                size="sm"
                variant="outline"
                onClick={() => exportToCsv('sales_invoices', filteredSalesInvoices.map((i) => ({
                  InvoiceNumber: i.invoiceNumber,
                  Date: i.createdAt,
                  Customer: i.customer?.name || 'Retail Customer',
                  TaxableAmount: i.taxableAmount,
                  CGST: i.cgstAmount,
                  SGST: i.sgstAmount,
                  TotalAmount: i.totalAmount,
                  PaidAmount: i.paidAmount,
                  Outstanding: i.outstandingAmount,
                  Status: i.paymentStatus,
                })))}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                Export CSV
              </Button>
            </div>
          </div>

          <Card variant="solid" className="p-6 border-slate-200 space-y-4">
            <Table
              columns={[
                {
                  header: 'Invoice #',
                  cell: (item: any) => (
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{item.invoiceNumber}</p>
                      <p className="text-[11px] text-slate-500">{new Date(item.createdAt).toLocaleDateString()}</p>
                    </div>
                  ),
                },
                {
                  header: 'Customer',
                  cell: (item: any) => (
                    <span className="text-xs text-slate-700 font-medium">
                      {item.customer?.name || 'Walk-in Retail Customer'}
                    </span>
                  ),
                },
                {
                  header: 'Branch',
                  cell: (item: any) => (
                    <Badge variant="neutral" size="sm">
                      {item.outlet?.name}
                    </Badge>
                  ),
                },
                {
                  header: 'Taxable / GST',
                  cell: (item: any) => (
                    <div className="text-xs text-slate-500">
                      <p>₹{item.taxableAmount.toFixed(2)}</p>
                      <p className="text-[10px] text-purple-600 font-mono">GST: ₹{(item.cgstAmount + item.sgstAmount).toFixed(2)}</p>
                    </div>
                  ),
                },
                {
                  header: 'Total / Balance',
                  cell: (item: any) => (
                    <div className="text-xs">
                      <p className="font-bold text-slate-900">₹{item.totalAmount.toFixed(2)}</p>
                      {item.outstandingAmount > 0 && (
                        <p className="text-[11px] text-amber-600">Due: ₹{item.outstandingAmount.toFixed(2)}</p>
                      )}
                    </div>
                  ),
                },
                {
                  header: 'Status',
                  cell: (item: any) => (
                    <Badge
                      variant={
                        item.paymentStatus === 'PAID'
                          ? 'success'
                          : item.paymentStatus === 'PARTIALLY_PAID'
                            ? 'warning'
                            : 'danger'
                      }
                      size="sm"
                    >
                      {item.paymentStatus}
                    </Badge>
                  ),
                },
                {
                  header: 'Action',
                  cell: (item: any) => (
                    <Button
                      size="sm"
                      variant="glass"
                      onClick={() => setSelectedInvoice(item)}
                      leftIcon={<Eye className="w-3.5 h-3.5 text-amber-600" />}
                    >
                      View
                    </Button>
                  ),
                },
              ]}
              data={filteredSalesInvoices}
              isLoading={isLoading}
            />
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PURCHASE BILLS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'purchase-bills' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl glass-panel border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex-1 w-full md:w-auto relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search purchase bill or supplier..."
                value={searchBill}
                onChange={(e) => setSearchBill(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <Select
                value={filterBillStatus}
                onChange={(e) => setFilterBillStatus(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: 'PAID', label: 'Paid' },
                  { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
                  { value: 'UNPAID', label: 'Unpaid' },
                ]}
              />

              <Button
                size="sm"
                variant="outline"
                onClick={() => exportToCsv('purchase_bills', filteredPurchaseBills.map((b) => ({
                  BillNumber: b.billNumber,
                  SupplierInvoice: b.supplierInvoiceNumber,
                  Supplier: b.supplier?.name,
                  PurchaseDate: b.purchaseDate,
                  DueDate: b.dueDate,
                  TaxableAmount: b.taxableAmount,
                  TotalAmount: b.totalAmount,
                  PaidAmount: b.paidAmount,
                  Outstanding: b.outstandingAmount,
                  Status: b.paymentStatus,
                })))}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                Export CSV
              </Button>
            </div>
          </div>

          <Card variant="solid" className="p-6 border-slate-200 space-y-4">
            <Table
              columns={[
                {
                  header: 'Bill & Supplier Ref',
                  cell: (item: any) => (
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{item.billNumber}</p>
                      <p className="text-[11px] text-slate-500 font-mono">Ref: {item.supplierInvoiceNumber || 'N/A'}</p>
                    </div>
                  ),
                },
                {
                  header: 'Supplier',
                  cell: (item: any) => (
                    <div>
                      <p className="font-bold text-slate-800 text-xs">{item.supplier?.name}</p>
                      <p className="text-[11px] text-slate-500">{item.supplier?.phone}</p>
                    </div>
                  ),
                },
                {
                  header: 'Dates',
                  cell: (item: any) => (
                    <div className="text-xs text-slate-500">
                      <p>Date: {new Date(item.purchaseDate).toLocaleDateString()}</p>
                      {item.dueDate && (
                        <p className="text-amber-600">Due: {new Date(item.dueDate).toLocaleDateString()}</p>
                      )}
                    </div>
                  ),
                },
                {
                  header: 'Total / Outstanding',
                  cell: (item: any) => (
                    <div className="text-xs">
                      <p className="font-bold text-slate-900">₹{item.totalAmount.toFixed(2)}</p>
                      {item.outstandingAmount > 0 && (
                        <p className="text-[11px] text-rose-600">Due: ₹{item.outstandingAmount.toFixed(2)}</p>
                      )}
                    </div>
                  ),
                },
                {
                  header: 'Status',
                  cell: (item: any) => (
                    <Badge
                      variant={item.paymentStatus === 'PAID' ? 'success' : 'danger'}
                      size="sm"
                    >
                      {item.paymentStatus}
                    </Badge>
                  ),
                },
                {
                  header: 'Action',
                  cell: (item: any) => (
                    <Button
                      size="sm"
                      variant="glass"
                      onClick={() => setSelectedBill(item)}
                      leftIcon={<Eye className="w-3.5 h-3.5" />}
                    >
                      View
                    </Button>
                  ),
                },
              ]}
              data={filteredPurchaseBills}
              isLoading={isLoading}
            />
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. PAYMENTS & RECEIPTS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'payments' && (
        <Card variant="solid" className="p-6 border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Payments & Receipts Ledger</h3>
              <p className="text-xs text-slate-500">Reconciled customer receipts, supplier payouts, and refund transactions.</p>
            </div>
            <Button
              size="sm"
              onClick={() => setIsRecordPaymentModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Record Payment
            </Button>
          </div>

          <Table
            columns={[
              {
                header: 'Payment # & Type',
                cell: (item: any) => (
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{item.paymentNumber}</p>
                    <Badge
                      variant={item.type === 'CUSTOMER_RECEIPT' ? 'success' : 'danger'}
                      size="sm"
                    >
                      {item.type === 'CUSTOMER_RECEIPT' ? 'Customer Receipt' : 'Supplier Payment'}
                    </Badge>
                  </div>
                ),
              },
              {
                header: 'Party',
                cell: (item: any) => (
                  <span className="text-xs text-slate-800 font-medium">
                    {item.customer?.name || item.supplier?.name || 'Direct / Walk-In'}
                  </span>
                ),
              },
              {
                header: 'Amount',
                cell: (item: any) => (
                  <span className={`text-sm font-bold ${item.type === 'CUSTOMER_RECEIPT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {item.type === 'CUSTOMER_RECEIPT' ? '+' : '-'}₹{item.amount.toLocaleString()}
                  </span>
                ),
              },
              {
                header: 'Payment Method',
                cell: (item: any) => (
                  <Badge variant="neutral" size="sm">
                    {item.paymentMethod}
                  </Badge>
                ),
              },
              {
                header: 'Date & Reference',
                cell: (item: any) => (
                  <div className="text-xs text-slate-500">
                    <p>{new Date(item.transactionDate).toLocaleDateString()}</p>
                    {item.referenceNumber && <p className="text-[10px] text-slate-500 font-mono">{item.referenceNumber}</p>}
                  </div>
                ),
              },
            ]}
            data={payments}
            isLoading={isLoading}
          />
        </Card>
      )}

      {/* ========================================================================= */}
      {/* 5. ACCOUNTS RECEIVABLE TAB */}
      {/* ========================================================================= */}
      {activeTab === 'receivables' && (
        <div className="space-y-6">
          {/* Aging Buckets Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <Card variant="glass" className="p-3 text-center space-y-0.5">
              <span className="text-[11px] text-slate-500 uppercase font-semibold">Current</span>
              <p className="text-lg font-black text-emerald-600">₹{(receivablesData.buckets.current || 0).toLocaleString()}</p>
            </Card>
            <Card variant="glass" className="p-3 text-center space-y-0.5">
              <span className="text-[11px] text-slate-500 uppercase font-semibold">1–30 Days</span>
              <p className="text-lg font-black text-amber-300">₹{(receivablesData.buckets.days1_30 || 0).toLocaleString()}</p>
            </Card>
            <Card variant="glass" className="p-3 text-center space-y-0.5">
              <span className="text-[11px] text-slate-500 uppercase font-semibold">31–60 Days</span>
              <p className="text-lg font-black text-amber-500">₹{(receivablesData.buckets.days31_60 || 0).toLocaleString()}</p>
            </Card>
            <Card variant="glass" className="p-3 text-center space-y-0.5">
              <span className="text-[11px] text-slate-500 uppercase font-semibold">61–90 Days</span>
              <p className="text-lg font-black text-rose-600">₹{(receivablesData.buckets.days61_90 || 0).toLocaleString()}</p>
            </Card>
            <Card variant="glass" className="p-3 text-center space-y-0.5">
              <span className="text-[11px] text-slate-500 uppercase font-semibold">90+ Days</span>
              <p className="text-lg font-black text-rose-600">₹{(receivablesData.buckets.days90Plus || 0).toLocaleString()}</p>
            </Card>
            <Card variant="solid" className="p-3 text-center space-y-0.5 border-amber-500/30 bg-amber-950/20">
              <span className="text-[11px] text-amber-300 uppercase font-bold">Total Due</span>
              <p className="text-lg font-black text-slate-900">₹{(receivablesData.buckets.total || 0).toLocaleString()}</p>
            </Card>
          </div>

          <Card variant="solid" className="p-6 border-slate-200 space-y-4">
            <Table
              columns={[
                {
                  header: 'Customer',
                  cell: (item: any) => (
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{item.customerName}</p>
                      <p className="text-xs text-slate-500">{item.customerPhone || 'Walk-in customer'}</p>
                    </div>
                  ),
                },
                {
                  header: 'Invoice #',
                  cell: (item: any) => <span className="font-mono text-xs text-slate-700">{item.invoiceNumber}</span>,
                },
                {
                  header: 'Due Date',
                  cell: (item: any) => <span className="text-xs text-slate-500">{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'N/A'}</span>,
                },
                {
                  header: 'Outstanding Balance',
                  cell: (item: any) => <span className="font-bold text-sm text-amber-600">₹{item.outstandingAmount.toFixed(2)}</span>,
                },
                {
                  header: 'Aging Bucket',
                  cell: (item: any) => (
                    <Badge variant={item.bucket === 'Current' ? 'success' : 'danger'} size="sm">
                      {item.bucket} ({item.daysOverdue}d)
                    </Badge>
                  ),
                },
              ]}
              data={receivablesData.items || []}
              isLoading={isLoading}
            />
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. ACCOUNTS PAYABLE TAB */}
      {/* ========================================================================= */}
      {activeTab === 'payables' && (
        <div className="space-y-6">
          {/* Aging Buckets Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <Card variant="glass" className="p-3 text-center space-y-0.5">
              <span className="text-[11px] text-slate-500 uppercase font-semibold">Current</span>
              <p className="text-lg font-black text-emerald-600">₹{(payablesData.buckets.current || 0).toLocaleString()}</p>
            </Card>
            <Card variant="glass" className="p-3 text-center space-y-0.5">
              <span className="text-[11px] text-slate-500 uppercase font-semibold">1–30 Days</span>
              <p className="text-lg font-black text-amber-300">₹{(payablesData.buckets.days1_30 || 0).toLocaleString()}</p>
            </Card>
            <Card variant="glass" className="p-3 text-center space-y-0.5">
              <span className="text-[11px] text-slate-500 uppercase font-semibold">31–60 Days</span>
              <p className="text-lg font-black text-amber-500">₹{(payablesData.buckets.days31_60 || 0).toLocaleString()}</p>
            </Card>
            <Card variant="glass" className="p-3 text-center space-y-0.5">
              <span className="text-[11px] text-slate-500 uppercase font-semibold">61–90 Days</span>
              <p className="text-lg font-black text-rose-600">₹{(payablesData.buckets.days61_90 || 0).toLocaleString()}</p>
            </Card>
            <Card variant="glass" className="p-3 text-center space-y-0.5">
              <span className="text-[11px] text-slate-500 uppercase font-semibold">90+ Days</span>
              <p className="text-lg font-black text-rose-600">₹{(payablesData.buckets.days90Plus || 0).toLocaleString()}</p>
            </Card>
            <Card variant="solid" className="p-3 text-center space-y-0.5 border-rose-500/30 bg-rose-950/20">
              <span className="text-[11px] text-rose-300 uppercase font-bold">Total Payable</span>
              <p className="text-lg font-black text-slate-900">₹{(payablesData.buckets.total || 0).toLocaleString()}</p>
            </Card>
          </div>

          <Card variant="solid" className="p-6 border-slate-200 space-y-4">
            <Table
              columns={[
                {
                  header: 'Supplier',
                  cell: (item: any) => (
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{item.supplierName}</p>
                      <p className="text-xs text-slate-500">Bill: {item.billNumber}</p>
                    </div>
                  ),
                },
                {
                  header: 'Bill Date',
                  cell: (item: any) => <span className="text-xs text-slate-500">{new Date(item.purchaseDate).toLocaleDateString()}</span>,
                },
                {
                  header: 'Due Date',
                  cell: (item: any) => <span className="text-xs text-amber-600">{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'N/A'}</span>,
                },
                {
                  header: 'Outstanding Balance',
                  cell: (item: any) => <span className="font-bold text-sm text-rose-600">₹{item.outstandingAmount.toFixed(2)}</span>,
                },
                {
                  header: 'Aging Bucket',
                  cell: (item: any) => (
                    <Badge variant={item.bucket === 'Current' ? 'success' : 'danger'} size="sm">
                      {item.bucket} ({item.daysOverdue}d)
                    </Badge>
                  ),
                },
              ]}
              data={payablesData.items || []}
              isLoading={isLoading}
            />
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. EXPENSES TAB */}
      {/* ========================================================================= */}
      {activeTab === 'expenses' && (
        <Card variant="solid" className="p-6 border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Operational Expenses Ledger</h3>
              <p className="text-xs text-slate-500">Rent, electricity, staff refreshments, maintenance, and logistics.</p>
            </div>
            <Button
              size="sm"
              onClick={() => setIsAddExpenseModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Expense
            </Button>
          </div>

          <Table
            columns={[
              {
                header: 'Expense # & Category',
                cell: (item: any) => (
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{item.expenseNumber}</p>
                    <Badge variant="neutral" size="sm">{item.category}</Badge>
                  </div>
                ),
              },
              {
                header: 'Description',
                cell: (item: any) => (
                  <div>
                    <p className="text-xs text-slate-800 font-medium">{item.description}</p>
                    {item.vendorName && <p className="text-[11px] text-slate-500">Payee: {item.vendorName}</p>}
                  </div>
                ),
              },
              {
                header: 'Amount',
                cell: (item: any) => (
                  <span className="font-bold text-sm text-amber-600">
                    ₹{item.amount.toLocaleString()}
                  </span>
                ),
              },
              {
                header: 'Payment Method',
                cell: (item: any) => <Badge variant="neutral" size="sm">{item.paymentMethod}</Badge>,
              },
              {
                header: 'Date',
                cell: (item: any) => <span className="text-xs text-slate-500">{new Date(item.expenseDate).toLocaleDateString()}</span>,
              },
            ]}
            data={expenses}
            isLoading={isLoading}
          />
        </Card>
      )}

      {/* ========================================================================= */}
      {/* 8. CASH & BANK TAB */}
      {/* ========================================================================= */}
      {activeTab === 'cash-bank' && (
        <div className="space-y-6">
          <Card variant="solid" className="p-6 border-slate-200 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-yellow-400" /> POS Cash Register Float & Shift Reconciliation
            </h3>
            <Table
              columns={[
                {
                  header: 'Register & Outlet',
                  cell: (item: any) => (
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{item.outlet?.name}</p>
                      <p className="text-[11px] text-slate-500">Register Session #{item.id.slice(0, 8)}</p>
                    </div>
                  ),
                },
                {
                  header: 'Opening Float',
                  cell: (item: any) => <span className="text-xs text-slate-700 font-bold">₹{item.openingFloat.toFixed(2)}</span>,
                },
                {
                  header: 'Cash Sales',
                  cell: (item: any) => <span className="text-xs text-emerald-600 font-bold">+₹{item.cashSales.toFixed(2)}</span>,
                },
                {
                  header: 'Cash Paid Out',
                  cell: (item: any) => <span className="text-xs text-rose-600 font-bold">-₹{item.cashPaidOut.toFixed(2)}</span>,
                },
                {
                  header: 'Expected Closing Cash',
                  cell: (item: any) => <span className="text-sm font-black text-slate-900">₹{item.expectedClosingCash.toFixed(2)}</span>,
                },
                {
                  header: 'Status',
                  cell: (item: any) => (
                    <Badge variant={item.status === 'OPEN' ? 'success' : 'neutral'} size="sm">
                      {item.status}
                    </Badge>
                  ),
                },
              ]}
              data={cashBankData.sessions || []}
              isLoading={isLoading}
            />
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. LEDGER TAB */}
      {/* ========================================================================= */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-1.5 rounded-xl bg-white border border-slate-200 max-w-md">
            {(['sales', 'purchase', 'expense', 'customer'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedLedgerType(type)}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg uppercase tracking-wider transition-all ${
                  selectedLedgerType === type
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <Card variant="solid" className="p-6 border-slate-200 space-y-4">
            <Table
              columns={[
                {
                  header: 'Date',
                  cell: (item: any) => <span className="text-xs text-slate-500">{new Date(item.date).toLocaleDateString()}</span>,
                },
                {
                  header: 'Reference',
                  cell: (item: any) => <span className="font-mono text-xs font-bold text-slate-900">{item.reference}</span>,
                },
                {
                  header: 'Description',
                  cell: (item: any) => <span className="text-xs text-slate-800 font-medium">{item.description}</span>,
                },
                {
                  header: 'Debit',
                  cell: (item: any) => <span className="text-xs text-emerald-600 font-mono">{item.debit > 0 ? `₹${item.debit.toFixed(2)}` : '-'}</span>,
                },
                {
                  header: 'Credit',
                  cell: (item: any) => <span className="text-xs text-rose-600 font-mono">{item.credit > 0 ? `₹${item.credit.toFixed(2)}` : '-'}</span>,
                },
                {
                  header: 'Running Balance',
                  cell: (item: any) => <span className="text-xs font-black text-slate-900 font-mono">₹{item.runningBalance.toFixed(2)}</span>,
                },
              ]}
              data={ledgerEntries}
              isLoading={isLoading}
            />
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 10. GST & TAX TAB */}
      {/* ========================================================================= */}
      {activeTab === 'gst-tax' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card variant="glass" className="p-5 space-y-1">
              <span className="text-xs text-slate-500 font-semibold uppercase">Output GST (Sales)</span>
              <p className="text-3xl font-black text-emerald-600">₹{(taxData.summary?.totalOutputGst || 0).toFixed(2)}</p>
              <p className="text-xs text-slate-500">Tax collected on invoices</p>
            </Card>

            <Card variant="glass" className="p-5 space-y-1">
              <span className="text-xs text-slate-500 font-semibold uppercase">Input GST (ITC Credit)</span>
              <p className="text-3xl font-black text-sky-600">₹{(taxData.summary?.totalInputGst || 0).toFixed(2)}</p>
              <p className="text-xs text-slate-500">Eligible input tax credit</p>
            </Card>

            <Card variant="solid" className="p-5 space-y-1 border-purple-500/30 bg-purple-950/20">
              <span className="text-xs text-purple-300 font-bold uppercase">Net GST Payable</span>
              <p className="text-3xl font-black text-slate-900">₹{(taxData.summary?.netGstPayable || 0).toFixed(2)}</p>
              <p className="text-xs text-purple-300/80">Output Tax - Input Tax Credit</p>
            </Card>
          </div>

          <Card variant="solid" className="p-6 border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Rate-Wise GST Slabs Breakdown</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportToCsv('gst_rate_breakdown', taxData.rateBreakdown || [])}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                Export GST Summary
              </Button>
            </div>

            <Table
              columns={[
                {
                  header: 'GST Rate Slab',
                  cell: (item: any) => <Badge variant="brand" size="md">{item.rate}% GST</Badge>,
                },
                {
                  header: 'Taxable Sales',
                  cell: (item: any) => <span className="text-xs font-mono text-slate-900">₹{item.taxableSales.toFixed(2)}</span>,
                },
                {
                  header: 'Output GST',
                  cell: (item: any) => <span className="text-xs font-mono text-emerald-600 font-bold">₹{item.outputGst.toFixed(2)}</span>,
                },
                {
                  header: 'Taxable Purchases',
                  cell: (item: any) => <span className="text-xs font-mono text-slate-900">₹{item.taxablePurchases.toFixed(2)}</span>,
                },
                {
                  header: 'Input GST Credit',
                  cell: (item: any) => <span className="text-xs font-mono text-sky-600 font-bold">₹{item.inputGst.toFixed(2)}</span>,
                },
              ]}
              data={taxData.rateBreakdown || []}
              isLoading={isLoading}
            />
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 11. REPORTS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && dashboardData && (
        <Card variant="solid" className="p-6 border-slate-200 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-900">Supermarket Profit & Loss Statement (P&L)</h3>
              <p className="text-xs text-slate-500">Calculated directly from finalized sales, line-item COGS, and operating expenses.</p>
            </div>
            <Badge variant="warning" size="md">Audited Real Data</Badge>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 text-sm">
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="font-bold text-slate-800">1. Gross Sales Revenue</span>
              <span className="font-bold text-slate-900">₹{dashboardData.kpis.totalSales.toFixed(2)}</span>
            </div>

            <div className="flex justify-between py-1 text-slate-500 pl-4">
              <span>Less: Cost of Goods Sold (COGS)</span>
              <span className="text-rose-600">-₹{dashboardData.kpis.cogs.toFixed(2)}</span>
            </div>

            <div className="flex justify-between py-2 border-t border-b border-slate-300 font-black text-emerald-600">
              <span>2. Gross Profit Margin</span>
              <span>₹{dashboardData.kpis.grossProfit.toFixed(2)}</span>
            </div>

            <div className="flex justify-between py-1 text-slate-500 pl-4">
              <span>Less: Operating Expenses (Rent, Power, Maintenance)</span>
              <span className="text-rose-600">-₹{dashboardData.kpis.totalExpenses.toFixed(2)}</span>
            </div>

            <div className="flex justify-between py-3 border-t-2 border-slate-600 font-black text-lg text-slate-900">
              <span>Net Operating Profit</span>
              <span className="text-amber-600">₹{dashboardData.kpis.netProfit.toFixed(2)}</span>
            </div>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* 12. EXPORT TAB */}
      {/* ========================================================================= */}
      {activeTab === 'export' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card variant="solid" className="p-5 border-slate-200 space-y-3">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" /> Sales Invoices Export
            </h4>
            <p className="text-xs text-slate-500">Complete sales ledger with customer GSTIN, taxable value, and tax split.</p>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => exportToCsv('sales_invoices', salesInvoices)}
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Export Sales CSV
            </Button>
          </Card>

          <Card variant="solid" className="p-5 border-slate-200 space-y-3">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-sky-600" /> Purchase Bills Export
            </h4>
            <p className="text-xs text-slate-500">Vendor purchase bills with supplier invoice refs and ITC input credit.</p>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => exportToCsv('purchase_bills', purchaseBills)}
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Export Purchases CSV
            </Button>
          </Card>

          <Card variant="solid" className="p-5 border-slate-200 space-y-3">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Percent className="w-4 h-4 text-purple-600" /> GST R-1 Tax Export
            </h4>
            <p className="text-xs text-slate-500">Output vs Input GST position with rate-wise taxable values.</p>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => exportToCsv('gst_summary', taxData.rateBreakdown)}
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Export GST Report
            </Button>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* INVOICE DETAIL MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title={`Sales Invoice: ${selectedInvoice?.invoiceNumber}`}
        subtitle={`Customer: ${selectedInvoice?.customer?.name || 'Walk-in Retail Customer'} • ${new Date(selectedInvoice?.createdAt || Date.now()).toLocaleDateString()}`}
      >
        {selectedInvoice && (
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2">
              <p className="font-bold text-slate-900 uppercase text-[11px]">Invoice Items</p>
              <div className="space-y-1">
                {selectedInvoice.items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between py-1 border-b border-slate-200 text-slate-700">
                    <span>{item.description} (x{item.quantity})</span>
                    <span className="font-mono font-bold text-slate-900">₹{item.totalAmount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
              <div className="flex justify-between text-slate-500">
                <span>Taxable Amount</span>
                <span>₹{selectedInvoice.taxableAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-purple-600">
                <span>CGST ({selectedInvoice.items?.[0]?.taxRate / 2 || 2.5}%)</span>
                <span>₹{selectedInvoice.cgstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-purple-600">
                <span>SGST ({selectedInvoice.items?.[0]?.taxRate / 2 || 2.5}%)</span>
                <span>₹{selectedInvoice.sgstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 pt-1 border-t border-slate-200">
                <span>Total Amount</span>
                <span className="text-amber-600">₹{selectedInvoice.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => alert('Printing invoice receipt...')}
                leftIcon={<Printer className="w-3.5 h-3.5" />}
              >
                Print Invoice
              </Button>
              <Button size="sm" onClick={() => setSelectedInvoice(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* RECORD PAYMENT MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isRecordPaymentModalOpen}
        onClose={() => setIsRecordPaymentModalOpen(false)}
        title="Record Financial Payment / Receipt"
        subtitle="Post customer receipt or supplier vendor payout to ledger."
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <Select
            label="Transaction Type"
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value as any)}
            options={[
              { value: 'CUSTOMER_RECEIPT', label: 'Customer Receipt (Money In)' },
              { value: 'SUPPLIER_PAYMENT', label: 'Supplier Payout (Money Out)' },
            ]}
          />

          <Input
            label="Payment Amount (₹)"
            type="number"
            min={1}
            required
            value={paymentAmount || ''}
            onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
          />

          <Select
            label="Payment Method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            options={[
              { value: 'UPI', label: 'UPI / Dynamic QR' },
              { value: 'CASH', label: 'Cash Till' },
              { value: 'BANK_TRANSFER', label: 'Bank Transfer (NEFT/RTGS)' },
              { value: 'CARD', label: 'Credit / Debit Card' },
            ]}
          />

          <Input
            label="Bank Ref / Transaction ID"
            placeholder="e.g. UPI/99881122 or CHQ-104"
            value={paymentRefNumber}
            onChange={(e) => setPaymentRefNumber(e.target.value)}
          />

          <Input
            label="Notes / Ledger Narration"
            placeholder="e.g. Part payment for monthly milk supplies"
            value={paymentNotes}
            onChange={(e) => setPaymentNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={() => setIsRecordPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Save Payment Entry
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* ADD EXPENSE MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAddExpenseModalOpen}
        onClose={() => setIsAddExpenseModalOpen(false)}
        title="Record Operational Business Expense"
        subtitle="Add legitimate expense entry to the financial statement."
      >
        <form onSubmit={handleCreateExpense} className="space-y-4">
          <Select
            label="Expense Category"
            value={expenseCategory}
            onChange={(e) => setExpenseCategory(e.target.value)}
            options={[
              { value: 'ELECTRICITY', label: 'Electricity / Power' },
              { value: 'RENT', label: 'Store Lease / Rent' },
              { value: 'MAINTENANCE', label: 'Repairs & Maintenance' },
              { value: 'SALARY', label: 'Staff Salaries' },
              { value: 'UTILITIES', label: 'Internet & Utilities' },
              { value: 'TRANSPORT', label: 'Logistics & Transport' },
              { value: 'OFFICE_EXPENSE', label: 'Office Supplies' },
              { value: 'MISCELLANEOUS', label: 'Miscellaneous' },
            ]}
          />

          <Input
            label="Description"
            required
            placeholder="e.g. Monthly commercial electricity bill"
            value={expenseDescription}
            onChange={(e) => setExpenseDescription(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount (₹)"
              type="number"
              min={1}
              required
              value={expenseAmount || ''}
              onChange={(e) => setExpenseAmount(parseFloat(e.target.value) || 0)}
            />
            <Input
              label="GST / Tax Component (₹)"
              type="number"
              min={0}
              value={expenseTax || ''}
              onChange={(e) => setExpenseTax(parseFloat(e.target.value) || 0)}
            />
          </div>

          <Select
            label="Payment Method"
            value={expenseMethod}
            onChange={(e) => setExpenseMethod(e.target.value)}
            options={[
              { value: 'UPI', label: 'UPI' },
              { value: 'CASH', label: 'Cash' },
              { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
              { value: 'CARD', label: 'Card' },
            ]}
          />

          <Input
            label="Vendor / Payee Name (Optional)"
            placeholder="e.g. TNEB Electricity Board"
            value={expenseVendor}
            onChange={(e) => setExpenseVendor(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={() => setIsAddExpenseModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Save Business Expense
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
