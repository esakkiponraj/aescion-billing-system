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
import { subscribeToCashierPresence, onSocketConnect } from '../../services/socket';

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

  // Real-time Cashier Live Presence Subscription
  useEffect(() => {
    const unsubscribePresence = subscribeToCashierPresence((data) => {
      console.log('[Owner Dashboard] Live Cashier Presence update received:', data);
      setSummary((prev: any) => {
        if (!prev) return prev;
        const currentList: any[] = prev.cashierPerformance || [];
        const exists = currentList.some((c) => c.cashierId === data.cashierId);

        let updatedList: any[];
        if (exists) {
          updatedList = currentList.map((c) =>
            c.cashierId === data.cashierId
              ? {
                  ...c,
                  status: data.status,
                  isActive: data.isOnline,
                  isOnline: data.isOnline,
                  lastSeenAt: data.lastSeenAt,
                }
              : c,
          );
        } else {
          // If a new cashier connected who wasn't in list, trigger background refresh
          fetchDashboardData(true);
          return prev;
        }

        return {
          ...prev,
          cashierPerformance: updatedList,
        };
      });
    });

    // Re-fetch dashboard data when owner socket reconnects to avoid stale presence state
    const unsubscribeConnect = onSocketConnect(() => {
      fetchDashboardData(true);
    });

    return () => {
      unsubscribePresence();
      unsubscribeConnect();
    };
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

    // Heartbeat auto-poll every 20 seconds for fallback real-time live synchronization
    const intervalId = setInterval(() => {
      fetchDashboardData(true);
    }, 20000);

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
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto w-full">
      {/* Hero Welcome & Pulse Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-6 rounded-xl bg-white border border-slate-200 shadow-sm w-full">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">
              Live Real-Time Engine Active
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
            Welcome, {user?.firstName || 'Owner'}
          </h1>
          <p className="text-xs text-slate-500 break-words">
            Business: <strong className="text-slate-800">{activeOrgName}</strong> • Branch: <strong className="text-slate-800">{activeOutletName || 'Main'}</strong>
          </p>
        </div>

        {/* Action Buttons: 2 stacked on small mobile, 3-col grid (Refresh 1col, POS 2col) when wide */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 w-full md:w-auto md:min-w-[340px] shrink-0">
          <Button
            size="md"
            variant="outline"
            onClick={() => fetchDashboardData(true)}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw className="w-4 h-4 shrink-0" />}
            className="w-full h-10 text-xs font-bold justify-center sm:col-span-1"
          >
            Refresh Feed
          </Button>

          {capabilities.dashboardCapabilities.showFastBillingAction ? (
            <Button
              size="md"
              onClick={() => navigate('/pos')}
              leftIcon={<ShoppingCart className="w-4 h-4 shrink-0" />}
              className="w-full h-10 text-xs font-bold justify-center sm:col-span-2 truncate"
            >
              <span className="truncate">{capabilities.terminology.posAction}</span>
            </Button>
          ) : (
            <Button
              size="md"
              onClick={() => navigate('/team')}
              leftIcon={<Briefcase className="w-4 h-4 shrink-0" />}
              className="w-full h-10 text-xs font-bold justify-center sm:col-span-2 truncate"
            >
              <span className="truncate">Manage Workspace</span>
            </Button>
          )}
        </div>
      </div>

      {/* Date Range Revenue Filter Bar */}
      <div className="p-4 sm:p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3 w-full">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-600 shrink-0" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Revenue Filter:</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono shrink-0">
            {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Filter button grid: 2 cols & 2 rows on mobile, 4 cols on sm+ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['TODAY', 'WEEK', 'MONTH', 'CUSTOM'] as DateFilterPreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => setDateFilter(preset)}
              className={`w-full h-9 rounded-lg text-xs font-bold transition-all flex items-center justify-center text-center select-none ${
                dateFilter === preset
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {preset === 'TODAY' ? 'Today' : preset === 'WEEK' ? 'This Week' : preset === 'MONTH' ? 'This Month' : 'Custom'}
            </button>
          ))}
        </div>

        {dateFilter === 'CUSTOM' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Start Date</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">End Date</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {/* Today Revenue */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 border-l-4 border-l-brand-600 shadow-sm space-y-2 w-full">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <span className="font-bold uppercase tracking-wider text-slate-700 text-xs truncate">Today Revenue</span>
            <Badge variant="brand" size="sm" dot className="shrink-0 whitespace-nowrap">
              Live
            </Badge>
          </div>
          <p className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 font-mono tracking-tight truncate">
            ₹{todayRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 leading-snug">
            {summary?.todaySalesCount ?? 0} completed bill(s) today
          </p>
        </div>

        {/* Estimated Gross Margin */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 border-l-4 border-l-emerald-500 shadow-sm space-y-2 w-full">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <span className="font-bold uppercase tracking-wider text-slate-700 text-xs truncate">Estimated Gross Margin</span>
            <Badge variant={Number(todayMargin) > 20 ? 'success' : 'neutral'} size="sm" className="shrink-0 whitespace-nowrap">
              {Number(todayMargin) > 20 ? 'High Profit' : 'Standard'}
            </Badge>
          </div>
          <p className="text-xl sm:text-2xl lg:text-3xl font-black text-emerald-600 font-mono tracking-tight truncate">
            {todayMargin}%
          </p>
          <p className="text-[11px] text-slate-500 leading-snug">
            Profit: ₹{(summary?.todayGrossProfit ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </p>
        </div>

        {/* Active Dining Tables / Branch Status */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 border-l-4 border-l-orange-500 shadow-sm space-y-2 w-full">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <span className="font-bold uppercase tracking-wider text-slate-700 text-xs truncate">
              {capabilities.enabledModules.tablesAndOrders ? 'Active Dining Tables' : 'Branch Status'}
            </span>
            <Badge variant="warning" size="sm" className="shrink-0 whitespace-nowrap">
              {activeDiningTables > 0 ? 'Occupied' : 'Operational'}
            </Badge>
          </div>
          <p className="text-xl sm:text-2xl lg:text-3xl font-black text-orange-600 font-mono tracking-tight truncate">
            {capabilities.enabledModules.tablesAndOrders ? `${activeDiningTables} Tables` : activeOutletName || 'Main Store'}
          </p>
          <p className="text-[11px] text-slate-500 leading-snug truncate">
            {capabilities.enabledModules.tablesAndOrders ? 'Live seated & dine-in orders' : `${capabilities.label} operational`}
          </p>
        </div>

        {/* Customer Receivables */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 border-l-4 border-l-purple-500 shadow-sm space-y-2 w-full">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <span className="font-bold uppercase tracking-wider text-slate-700 text-xs truncate">Customer Receivables</span>
            <Badge variant={customerReceivables > 0 ? 'warning' : 'success'} size="sm" className="shrink-0 whitespace-nowrap">
              {customerReceivables > 0 ? 'Pending' : 'Cleared'}
            </Badge>
          </div>
          <p className="text-xl sm:text-2xl lg:text-3xl font-black text-purple-700 font-mono tracking-tight truncate">
            ₹{customerReceivables.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 leading-snug truncate">
            Outstanding balance across invoices
          </p>
        </div>
      </div>

      {/* Commercial Documents Overview Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
        {/* Quotations Overview */}
        <div
          onClick={() => navigate('/quotations')}
          className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-amber-400 hover:shadow-xs transition-all cursor-pointer group w-full"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">Quotations</span>
            <span className="text-xs font-bold text-amber-600 group-hover:translate-x-0.5 transition-transform shrink-0">View all &rarr;</span>
          </div>
          <div className="flex items-baseline justify-between gap-2 mt-2">
            <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {summary?.totalQuotations ?? 0}
            </p>
            <span className="text-xs font-bold text-emerald-600 truncate">
              {summary?.acceptedQuotations ?? 0} Accepted
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            {summary?.pendingQuotations ?? 0} pending • {summary?.convertedQuotations ?? 0} converted
          </p>
        </div>

        {/* Invoices Overview */}
        <div
          onClick={() => navigate('/invoices')}
          className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer group w-full"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">Tax Invoices</span>
            <span className="text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform shrink-0">View all &rarr;</span>
          </div>
          <div className="flex items-baseline justify-between gap-2 mt-2">
            <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {summary?.totalInvoices ?? 0}
            </p>
            <span className="text-xs font-bold text-emerald-600 truncate">
              {summary?.paidInvoices ?? 0} Paid
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            ₹{((summary?.totalInvoiced ?? 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })} invoiced • {summary?.partiallyPaidInvoices ?? 0} partial
          </p>
        </div>

        {/* Receipts Overview */}
        <div
          onClick={() => navigate('/receipts')}
          className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-400 hover:shadow-xs transition-all cursor-pointer group w-full"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">Payment Receipts</span>
            <span className="text-xs font-bold text-emerald-600 group-hover:translate-x-0.5 transition-transform shrink-0">View all &rarr;</span>
          </div>
          <div className="flex items-baseline justify-between gap-2 mt-2">
            <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {summary?.totalReceipts ?? 0}
            </p>
            <span className="text-xs font-bold text-emerald-600 truncate">
              ₹{((summary?.totalCollected ?? 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            {summary?.todayReceipts ?? 0} receipts issued today
          </p>
        </div>
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
                <div key={b.outletId} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-800">{b.outletName}</span>
                    <span className="text-slate-900">₹{b.totalSales.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-brand-500 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(5, (b.totalSales / (todayRevenue || 1)) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>{b.invoiceCount} invoices</span>
                    <span>{((b.totalSales / (todayRevenue || 1)) * 100).toFixed(0)}% of total</span>
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
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Top Performing Items</h3>
            </div>
            <span className="text-[11px] text-slate-500">By Revenue</span>
          </div>

          <div className="space-y-2">
            {topSellingProducts.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No item sales recorded yet.</p>
            ) : (
              topSellingProducts.map((p, idx) => {
                const pName = p.name || p.productName || 'Item';
                const pQty = p.quantity ?? p.totalQuantity ?? 0;
                const pRev = Number(p.revenue ?? p.totalRevenue ?? 0);
                return (
                  <div key={p.productId || p.id || idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-900">{pName}</p>
                      <p className="text-[11px] text-slate-500">{pQty} units sold</p>
                    </div>
                    <span className="font-bold text-slate-900">₹{pRev.toLocaleString()}</span>
                  </div>
                );
              })
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
            <span className="text-[11px] text-slate-500">Live Presence</span>
          </div>

          <div className="space-y-2.5">
            {cashierPerformance.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No staff activity recorded.</p>
            ) : (
              cashierPerformance.map((c, idx) => {
                const isActive =
                  (c.status === 'ACTIVE' || c.status === 'Active' || c.isActive === true) &&
                  c.status !== 'INACTIVE' &&
                  c.status !== 'SUSPENDED';

                return (
                  <div key={c.cashierId || idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900">{c.cashierName}</p>
                        <Badge
                          variant={isActive ? 'success' : 'danger'}
                          size="sm"
                          dot
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <span className="font-mono font-bold text-emerald-600">
                        ₹{(c.todayCollected ?? c.totalSales ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{c.invoiceCount ?? 0} invoices • {c.receiptsGenerated ?? 0} receipts</span>
                      {c.quotationsCreated !== undefined && (
                        <span>{c.quotationsCreated} qtn ({c.quotationsAccepted ?? 0} acc)</span>
                      )}
                    </div>
                  </div>
                );
              })
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
              <table className="w-full text-left text-xs text-slate-700 min-w-[620px]">
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
                          ₹{Number(inv.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
