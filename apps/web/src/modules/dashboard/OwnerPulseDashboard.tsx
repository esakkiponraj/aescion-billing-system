import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap,
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  Users,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building,
  Briefcase,
  Layers,
  Activity,
  Package,
  Calendar,
  Filter,
  DollarSign,
  UtensilsCrossed,
  Store,
  RefreshCw,
  Award,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { useTenantStore } from '../../stores/tenantStore';
import { useAuthStore } from '../../stores/authStore';
import { apiRequest } from '../../services/api';
import { getBusinessTypeCapability } from '@aescion/types';

type DateFilterPreset = 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM';

export const OwnerPulseDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { activeOrgName, activeOutletName, activeOutletId, businessType } = useTenantStore();
  const { user } = useAuthStore();

  const capabilities = getBusinessTypeCapability(businessType);

  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);

  // Date Range Filters
  const [dateFilter, setDateFilter] = useState<DateFilterPreset>('TODAY');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const fetchDashboardData = useCallback(async (showRefreshingSpinner = false) => {
    try {
      if (showRefreshingSpinner) setIsRefreshing(true);
      else setIsLoading(true);

      let queryParams = new URLSearchParams();
      if (activeOutletId) queryParams.append('outletId', activeOutletId);

      const now = new Date();
      if (dateFilter === 'TODAY') {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        queryParams.append('startDate', todayStart.toISOString());
        queryParams.append('endDate', todayEnd.toISOString());
      } else if (dateFilter === 'WEEK') {
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        queryParams.append('startDate', weekStart.toISOString());
        queryParams.append('endDate', now.toISOString());
      } else if (dateFilter === 'MONTH') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        queryParams.append('startDate', monthStart.toISOString());
        queryParams.append('endDate', now.toISOString());
      } else if (dateFilter === 'CUSTOM' && customStartDate && customEndDate) {
        queryParams.append('startDate', new Date(customStartDate).toISOString());
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59);
        queryParams.append('endDate', end.toISOString());
      }

      const queryString = queryParams.toString();
      const url = `/finance/dashboard${queryString ? `?${queryString}` : ''}`;
      const data = await apiRequest<any>(url);
      setSummary(data);
      setLastRefreshedAt(new Date());
    } catch (err) {
      console.error('Failed to load dashboard summary:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeOutletId, dateFilter, customStartDate, customEndDate]);

  // Initial Fetch & Filter Updates
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Real-Time Event Sync: Listen for POS Sale Completion in Current Tab & Cross-Tabs
  useEffect(() => {
    const handleSaleEvent = (e: any) => {
      console.log('Real-time sale detected! Live refresh triggered on Owner Dashboard:', e?.detail);
      fetchDashboardData(true);
    };

    window.addEventListener('aescion:sale-completed', handleSaleEvent);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel = new BroadcastChannel('aescion_events');
        channel.onmessage = (msg) => {
          if (msg.data?.type === 'SALE_COMPLETED') {
            console.log('Cross-tab real-time sale received:', msg.data);
            fetchDashboardData(true);
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel error:', err);
      }
    }

    // Heartbeat auto-poll every 12 seconds for real-time live synchronization
    const intervalId = setInterval(() => {
      fetchDashboardData(true);
    }, 12000);

    return () => {
      window.removeEventListener('aescion:sale-completed', handleSaleEvent);
      if (channel) channel.close();
      clearInterval(intervalId);
    };
  }, [fetchDashboardData]);

  const dismissAlert = (id: string) => {
    setDismissedAlerts((prev) => [...prev, id]);
  };

  // KPIs
  const todayRevenue = summary?.todaySales ?? 0;
  const todayMargin = summary?.todayGrossMargin ?? 0;
  const activeDiningTables = summary?.activeDiningTables ?? 0;
  const customerReceivables = summary?.customerReceivables ?? 0;
  const totalSales = summary?.totalSales ?? 0;
  const grossMargin = summary?.grossMargin ?? 0;
  const totalInvoices = summary?.totalInvoices ?? 0;

  // Breakdown Data
  const salesByBranch: any[] = summary?.salesByBranch ?? [];
  const topSellingProducts: any[] = summary?.topSellingProducts ?? [];
  const lowStockProducts: any[] = summary?.lowStockProducts ?? [];
  const cashierPerformance: any[] = summary?.cashierPerformance ?? [];
  const recentSales: any[] = summary?.recentSales ?? [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Hero Welcome & Pulse Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">
              Live Real-Time Engine Active
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Welcome, {user?.firstName || 'Owner'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Business: <strong className="text-slate-800">{activeOrgName}</strong> • Branch: {activeOutletName}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchDashboardData(true)}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Feed
          </Button>

          {capabilities.dashboardCapabilities.showFastBillingAction ? (
            <Button
              size="md"
              onClick={() => navigate('/pos')}
              leftIcon={<ShoppingCart className="w-4 h-4" />}
            >
              {capabilities.terminology.posAction}
            </Button>
          ) : (
            <Button
              size="md"
              onClick={() => navigate('/team')}
              leftIcon={<Briefcase className="w-4 h-4" />}
            >
              Manage Workspace
            </Button>
          )}
        </div>
      </div>

      {/* Date Range Revenue Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-brand-600" />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Revenue Filter:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['TODAY', 'WEEK', 'MONTH', 'CUSTOM'] as DateFilterPreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => setDateFilter(preset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                dateFilter === preset
                  ? 'bg-brand-500 text-slate-900 shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {preset === 'TODAY' ? 'Today' : preset === 'WEEK' ? 'This Week' : preset === 'MONTH' ? 'This Month' : 'Custom Range'}
            </button>
          ))}

          {dateFilter === 'CUSTOM' && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-xs p-1.5 rounded-lg border border-slate-300 text-slate-800 bg-white"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-xs p-1.5 rounded-lg border border-slate-300 text-slate-800 bg-white"
              />
            </div>
          )}
        </div>

        <span className="text-[11px] text-slate-400 font-mono">
          Live Sync • {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today Revenue */}
        <Card variant="solid" className="space-y-2 border-l-4 border-l-brand-600 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-slate-700">Today Revenue</span>
            <Badge variant="brand" size="sm" dot>
              Live
            </Badge>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">
            ₹{todayRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500">
            {summary?.todaySalesCount ?? 0} completed bill(s) today
          </p>
        </Card>

        {/* Estimated Gross Margin */}
        <Card variant="solid" className="space-y-2 border-l-4 border-l-emerald-500 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-slate-700">Estimated Gross Margin</span>
            <Badge variant={Number(todayMargin) > 20 ? 'success' : 'neutral'} size="sm">
              {Number(todayMargin) > 20 ? 'High Profit' : 'Standard'}
            </Badge>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600">
            {todayMargin}%
          </p>
          <p className="text-[11px] text-slate-500">
            Profit: ₹{(summary?.todayGrossProfit ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </p>
        </Card>

        {/* Active Dining Tables / Branch Status */}
        <Card variant="solid" className="space-y-2 border-l-4 border-l-orange-500 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-slate-700">
              {capabilities.enabledModules.tablesAndOrders ? 'Active Dining Tables' : 'Branch Status'}
            </span>
            <Badge variant="warning" size="sm">
              {activeDiningTables > 0 ? 'Occupied' : 'Operational'}
            </Badge>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-orange-600">
            {capabilities.enabledModules.tablesAndOrders ? `${activeDiningTables} Tables` : activeOutletName || 'Main Store'}
          </p>
          <p className="text-[11px] text-slate-500">
            {capabilities.enabledModules.tablesAndOrders ? 'Live seated & dine-in orders' : `${capabilities.label} operational`}
          </p>
        </Card>

        {/* Customer Receivables */}
        <Card variant="solid" className="space-y-2 border-l-4 border-l-purple-500 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-slate-700">Customer Receivables</span>
            <Badge variant={customerReceivables > 0 ? 'warning' : 'success'} size="sm">
              {customerReceivables > 0 ? 'Pending' : 'Cleared'}
            </Badge>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-purple-700">
            ₹{customerReceivables.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500">
            Outstanding balance across invoices
          </p>
        </Card>
      </div>

      {/* Real-time Sales Analytics & Branch Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales by Branch */}
        <Card variant="solid" className="p-5 space-y-4 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-brand-600" />
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Branch Performance</h3>
            </div>
            <span className="text-[11px] text-slate-500">{salesByBranch.length} Branches</span>
          </div>

          <div className="space-y-3">
            {salesByBranch.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No branch sales recorded yet.</p>
            ) : (
              salesByBranch.map((b) => (
                <div key={b.outletId} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                    <span>{b.outletName} ({b.outletCode})</span>
                    <span className="text-brand-600">₹{b.totalSales.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{b.invoiceCount} invoices generated</span>
                    <span>{totalSales > 0 ? `${((b.totalSales / totalSales) * 100).toFixed(0)}% of sales` : '0%'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Top-Selling Products */}
        <Card variant="solid" className="p-5 space-y-4 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-brand-600" />
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Top Selling Items</h3>
            </div>
            <span className="text-[11px] text-slate-500">Highest Revenue</span>
          </div>

          <div className="space-y-2">
            {topSellingProducts.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No sales data for selected period.</p>
            ) : (
              topSellingProducts.map((prod, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 font-bold text-[11px] flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">{prod.name}</p>
                      <p className="text-[11px] text-slate-500">{prod.quantity} units sold</p>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900">₹{prod.revenue.toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Cashier-Wise Performance */}
        <Card variant="solid" className="p-5 space-y-4 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-600" />
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Cashier Performance</h3>
            </div>
            <span className="text-[11px] text-slate-500">Staff Sales</span>
          </div>

          <div className="space-y-2">
            {cashierPerformance.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No cashier transactions recorded.</p>
            ) : (
              cashierPerformance.map((c, idx) => (
                <div key={c.cashierId || idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{c.cashierName}</p>
                    <p className="text-[11px] text-slate-500">{c.invoiceCount} bills handled</p>
                  </div>
                  <span className="font-bold text-emerald-600">₹{c.totalSales.toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Low Stock Alerts & Recent Sales Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Low Stock Inventory Table */}
        <Card variant="solid" className="p-5 space-y-4 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Low Stock Inventory</h3>
            </div>
            <Badge variant="warning" size="sm">{lowStockProducts.length} Items</Badge>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {lowStockProducts.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">All items have healthy stock levels.</p>
            ) : (
              lowStockProducts.map((p) => (
                <div key={p.id} className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{p.name}</p>
                    <p className="text-[11px] text-slate-500 font-mono">SKU: {p.sku}</p>
                  </div>
                  <Badge variant={p.stockQty <= 5 ? 'danger' : 'warning'} size="sm">
                    {p.stockQty} Units Left
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Live Recent Transactions */}
        <div className="lg:col-span-2">
          <Card variant="solid" className="p-5 space-y-4 border-slate-200 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-600" />
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Live Recent Invoices</h3>
              </div>
              <span className="text-xs text-slate-500">Auto-updating feed</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Invoice #</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Branch / Cashier</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                    <th className="py-2.5 px-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {recentSales.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        No sales transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    recentSales.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {inv.customerName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {inv.outletName} • {inv.cashierName}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900">
                          ₹{inv.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Badge
                            variant={inv.paymentStatus === 'PAID' ? 'success' : inv.paymentStatus === 'PARTIALLY_PAID' ? 'warning' : 'danger'}
                            size="sm"
                          >
                            {inv.paymentStatus}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500 font-mono text-[11px]">
                          {new Date(inv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
