import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  PauseCircle,
  Play,
  RotateCcw,
  Receipt,
  CreditCard,
  QrCode,
  Banknote,
  DollarSign,
  Sparkles,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Lock,
  Unlock,
  Store,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { useTenantStore } from '../../stores/tenantStore';
import { useAuthStore } from '../../stores/authStore';
import { apiRequest } from '../../services/api';

interface HeldOrderItem {
  id: string;
  holdNumber: string;
  customer: string;
  items: number;
  total: number;
  notes?: string;
  orderType?: string;
  tableNumber?: string;
  time: string;
  createdAt: string;
}

export const CashierWorkspace: React.FC = () => {
  const navigate = useNavigate();
  const { activeOutletName, activeOrgName, authorityLimits } = useTenantStore();
  const { user } = useAuthStore();

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Shift Management Modals
  const [isStartShiftModalOpen, setIsStartShiftModalOpen] = useState(false);
  const [openingFloat, setOpeningFloat] = useState<number>(1000);
  const [startShiftError, setStartShiftError] = useState<string | null>(null);
  const [isSubmittingShift, setIsSubmittingShift] = useState(false);

  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [actualClosingCash, setActualClosingCash] = useState<number>(0);
  const [closeShiftNotes, setCloseShiftNotes] = useState<string>('');
  const [closeShiftError, setCloseShiftError] = useState<string | null>(null);
  const [isSubmittingCloseShift, setIsSubmittingCloseShift] = useState(false);

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchCashierDashboard = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) setIsRefreshing(true);
      else setIsLoading(true);
      setDashboardError(null);

      const data = await apiRequest<any>('/finance/cashier-dashboard');
      setDashboardData(data);
      if (data?.shiftCashInRegister !== undefined) {
        setActualClosingCash(data.shiftCashInRegister);
      }
    } catch (err: any) {
      console.error('Failed to load cashier dashboard:', err);
      setDashboardError(err.message || 'Access Denied: Unable to load cashier dashboard.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCashierDashboard();
  }, [fetchCashierDashboard, activeOutletName]);

  // Real-Time Event Sync: Listen for POS billing, held orders, and shift updates
  useEffect(() => {
    const handleRefreshEvent = (e?: any) => {
      console.log('Real-time event received in Cashier Workspace:', e?.detail);
      fetchCashierDashboard(true);
    };

    window.addEventListener('aescion:sale-completed', handleRefreshEvent);
    window.addEventListener('aescion:held-order-updated', handleRefreshEvent);
    window.addEventListener('aescion:shift-updated', handleRefreshEvent);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel = new BroadcastChannel('aescion_events');
        channel.onmessage = (msg) => {
          if (
            msg.data?.type === 'SALE_COMPLETED' ||
            msg.data?.type === 'HELD_ORDER_UPDATED' ||
            msg.data?.type === 'SHIFT_UPDATED'
          ) {
            fetchCashierDashboard(true);
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel error:', err);
      }
    }

    const intervalId = setInterval(() => {
      // Only poll if no blocking permission error
      if (!dashboardError) {
        fetchCashierDashboard(true);
      }
    }, 10000);

    return () => {
      window.removeEventListener('aescion:sale-completed', handleRefreshEvent);
      window.removeEventListener('aescion:held-order-updated', handleRefreshEvent);
      window.removeEventListener('aescion:shift-updated', handleRefreshEvent);
      if (channel) channel.close();
      clearInterval(intervalId);
    };
  }, [fetchCashierDashboard, dashboardError]);

  const hasActiveShift = Boolean(dashboardData?.hasActiveShift);

  // Global F2 Keyboard Shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        if (hasActiveShift) {
          navigate('/pos');
        } else {
          setStartShiftError(null);
          setIsStartShiftModalOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasActiveShift, navigate]);

  // Start Shift Handler
  const handleStartShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setStartShiftError(null);
    setIsSubmittingShift(true);
    try {
      await apiRequest('/finance/shifts/open', {
        method: 'POST',
        body: JSON.stringify({
          openingFloat: Number(openingFloat),
          openingCash: Number(openingFloat),
        }),
      });
      setIsStartShiftModalOpen(false);
      setStatusMessage({ type: 'success', text: `Shift started with opening float of ₹${Number(openingFloat).toLocaleString()}!` });
      window.dispatchEvent(new CustomEvent('aescion:shift-updated'));
      await fetchCashierDashboard();
    } catch (err: any) {
      setStartShiftError(err.message || 'Failed to start shift.');
    } finally {
      setIsSubmittingShift(false);
    }
  };

  // Close Shift Handler
  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setCloseShiftError(null);
    setIsSubmittingCloseShift(true);
    try {
      const res = await apiRequest<any>('/finance/shifts/close', {
        method: 'POST',
        body: JSON.stringify({
          actualClosingCash: Number(actualClosingCash),
          notes: closeShiftNotes,
        }),
      });
      setIsCloseShiftModalOpen(false);
      setStatusMessage({
        type: 'success',
        text: `Shift closed successfully! Expected: ₹${res.expectedClosingCash.toLocaleString()}, Actual: ₹${res.actualClosingCash.toLocaleString()}.`,
      });
      window.dispatchEvent(new CustomEvent('aescion:shift-updated'));
      await fetchCashierDashboard();
    } catch (err: any) {
      setCloseShiftError(err.message || 'Failed to close shift.');
    } finally {
      setIsSubmittingCloseShift(false);
    }
  };

  // Resume Held Order
  const handleResumeHeldOrder = (heldId: string) => {
    navigate(`/pos?resumeHeldId=${heldId}`);
  };

  // Cancel Held Order
  const handleCancelHeldOrder = async (heldId: string) => {
    if (!confirm('Are you sure you want to cancel and remove this held order?')) return;
    try {
      await apiRequest(`/finance/held-orders/${heldId}`, { method: 'DELETE' });
      window.dispatchEvent(new CustomEvent('aescion:held-order-updated'));
      await fetchCashierDashboard(true);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel held order.');
    }
  };
  const shiftCash = dashboardData?.shiftCashInRegister ?? 0;
  const shiftDigital = dashboardData?.shiftDigitalAndUpi ?? 0;
  const shiftTransactions = dashboardData?.shiftTransactionsCount ?? 0;
  const heldOrders: HeldOrderItem[] = dashboardData?.heldOrders ?? [];
  const heldCount = dashboardData?.heldOrdersCount ?? heldOrders.length;
  const heldTotal = dashboardData?.heldOrdersTotal ?? 0;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto w-full">
      {/* Cashier Greeting & Shift Action Hero Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-6 rounded-xl bg-white border border-slate-200 shadow-sm w-full">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${hasActiveShift ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'} shrink-0`}
            />
            <span
              className={`text-xs font-bold uppercase tracking-widest ${hasActiveShift ? 'text-emerald-700' : 'text-amber-700'}`}
            >
              {hasActiveShift ? `Shift Active • ${activeOutletName}` : `No Active Shift • ${activeOutletName}`}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
            Hi, {user?.firstName || 'Cashier'}!
          </h1>
          <p className="text-xs text-slate-500 max-w-md break-words">
            {hasActiveShift ? (
              <>
                Register shift active since{' '}
                <strong className="text-slate-800">
                  {new Date(dashboardData?.shift?.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </strong>
                . Authorized discount ceiling:{' '}
                <strong className="text-brand-600">{authorityLimits.maxDiscountPercent}%</strong>.
              </>
            ) : (
              <>Start your register shift to begin billing customers and tracking live cash float.</>
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full md:w-auto shrink-0">
          <Button
            size="md"
            variant="outline"
            onClick={() => fetchCashierDashboard(true)}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw className="w-4 h-4 shrink-0" />}
            className="w-full sm:w-auto h-10 text-xs font-bold justify-center"
          >
            Refresh
          </Button>

          {hasActiveShift ? (
            <>
              <Button
                size="md"
                variant="outline"
                onClick={() => setIsCloseShiftModalOpen(true)}
                leftIcon={<Lock className="w-4 h-4 text-slate-500 shrink-0" />}
                className="w-full sm:w-auto h-10 text-xs font-bold text-slate-700 hover:text-rose-600 hover:border-rose-300 justify-center"
              >
                Close Shift
              </Button>
              <Button
                size="md"
                onClick={() => navigate('/pos')}
                className="w-full sm:w-auto h-10 text-xs font-bold shadow-md shadow-brand-500/20 justify-center truncate"
                leftIcon={<ShoppingCart className="w-4 h-4 shrink-0" />}
              >
                <span className="truncate">Open POS Register (F2)</span>
              </Button>
            </>
          ) : (
            <Button
              size="md"
              onClick={() => setIsStartShiftModalOpen(true)}
              className="w-full sm:w-auto h-10 text-xs font-bold shadow-md shadow-brand-500/20 bg-emerald-600 hover:bg-emerald-700 text-white justify-center truncate"
              leftIcon={<Unlock className="w-4 h-4 shrink-0" />}
            >
              <span className="truncate">Start Shift (F2)</span>
            </Button>
          )}
        </div>
      </div>

      {dashboardError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-rose-900">Dashboard Authorization Notice</h4>
              <p className="text-[11px] text-rose-700">{dashboardError}</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => fetchCashierDashboard(true)}
            variant="outline"
            className="border-rose-300 text-rose-700 hover:bg-rose-100 shrink-0 w-full sm:w-auto"
            isLoading={isRefreshing}
          >
            Retry
          </Button>
        </div>
      )}

      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium w-full ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="font-bold text-slate-500 hover:text-slate-900 ml-4">
            ✕
          </button>
        </div>
      )}

      {/* Inactive Shift Banner */}
      {!hasActiveShift && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-amber-900">Start a shift to begin billing.</h4>
              <p className="text-[11px] text-amber-700">
                Shift cash and digital transactions are logged only during an active cashier session.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setIsStartShiftModalOpen(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 w-full sm:w-auto"
          >
            Start Shift Now
          </Button>
        </div>
      )}

      {/* Cashier Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
        {/* Shift Cash in Register */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 border-l-4 border-l-brand-600 shadow-sm space-y-2 w-full">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <span className="font-bold uppercase tracking-wider text-slate-700 text-xs truncate">Shift Cash In Register</span>
            <Badge variant={hasActiveShift ? 'brand' : 'neutral'} size="sm" dot={hasActiveShift} className="shrink-0 whitespace-nowrap">
              {hasActiveShift ? 'Live' : 'Shift Closed'}
            </Badge>
          </div>
          <p className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 font-mono tracking-tight truncate">
            ₹{shiftCash.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 leading-snug truncate">
            {hasActiveShift
              ? `Opening float: ₹${(dashboardData?.shift?.openingFloat ?? 0).toLocaleString()}`
              : 'Start a shift to begin billing'}
          </p>
        </div>

        {/* Shift Digital & UPI */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 border-l-4 border-l-emerald-500 shadow-sm space-y-2 w-full">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <span className="font-bold uppercase tracking-wider text-slate-700 text-xs truncate">Shift Digital & UPI</span>
            <Badge variant={hasActiveShift ? 'success' : 'neutral'} size="sm" className="shrink-0 whitespace-nowrap">
              {hasActiveShift ? 'Synced' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-xl sm:text-2xl lg:text-3xl font-black text-emerald-600 font-mono tracking-tight truncate">
            ₹{shiftDigital.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 leading-snug truncate">
            UPI, QR, Cards & Digital payments
          </p>
        </div>

        {/* Held Orders */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 border-l-4 border-l-orange-500 shadow-sm space-y-2 w-full">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <span className="font-bold uppercase tracking-wider text-slate-700 text-xs truncate">Held Orders</span>
            <Badge variant={heldCount > 0 ? 'warning' : 'neutral'} size="sm" className="shrink-0 whitespace-nowrap">
              {heldCount} Active
            </Badge>
          </div>
          <p className="text-xl sm:text-2xl lg:text-3xl font-black text-orange-600 font-mono tracking-tight truncate">
            {heldCount}
          </p>
          <p className="text-[11px] text-slate-500 leading-snug truncate">
            {heldCount > 0 ? `Total: ₹${heldTotal.toLocaleString()}` : 'No parked tickets on this counter'}
          </p>
        </div>
      </div>

      {/* Cashier Commercial Documents Quick Access */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
        {/* Quotations */}
        <div
          onClick={() => navigate('/quotations')}
          className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-amber-400 hover:shadow-xs transition-all cursor-pointer group w-full"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">My Quotations</span>
            <span className="text-xs font-bold text-amber-600 group-hover:translate-x-0.5 transition-transform shrink-0">View &rarr;</span>
          </div>
          <div className="flex items-baseline justify-between gap-2 mt-2">
            <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {dashboardData?.myTotalQuotations ?? 0}
            </p>
            <span className="text-xs font-bold text-emerald-600 truncate">
              {dashboardData?.myAcceptedQuotations ?? 0} Accepted
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            {dashboardData?.myPendingQuotations ?? 0} pending customer acceptance
          </p>
        </div>

        {/* Invoices */}
        <div
          onClick={() => navigate('/invoices')}
          className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer group w-full"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">My Invoices</span>
            <span className="text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform shrink-0">View &rarr;</span>
          </div>
          <div className="flex items-baseline justify-between gap-2 mt-2">
            <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {dashboardData?.myTotalInvoices ?? 0}
            </p>
            <span className="text-xs font-bold text-brand-700 truncate">
              ₹{(dashboardData?.myTotalInvoiced ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            {dashboardData?.myPaidInvoices ?? 0} fully settled invoices
          </p>
        </div>

        {/* Receipts */}
        <div
          onClick={() => navigate('/receipts')}
          className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-400 hover:shadow-xs transition-all cursor-pointer group w-full"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">My Receipts</span>
            <span className="text-xs font-bold text-emerald-600 group-hover:translate-x-0.5 transition-transform shrink-0">View &rarr;</span>
          </div>
          <div className="flex items-baseline justify-between gap-2 mt-2">
            <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {dashboardData?.myTotalReceipts ?? 0}
            </p>
            <span className="text-xs font-bold text-emerald-600 truncate">
              ₹{(dashboardData?.myTotalCollected ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            Official payment receipts issued
          </p>
        </div>
      </div>

      {/* Parked / Held Bills Queue */}
      <Card variant="solid" className="p-4 sm:p-6 space-y-4 shadow-sm border-slate-200 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <PauseCircle className="w-5 h-5 text-orange-500 shrink-0" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">Held Bills & Parked Carts</h2>
              <p className="text-xs text-slate-500">
                Resume customer carts with delayed payments without stalling checkout queues.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/pos')}
            leftIcon={<ShoppingCart className="w-4 h-4" />}
            className="w-full sm:w-auto shrink-0"
          >
            Go to Billing POS
          </Button>
        </div>

        {heldOrders.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            No bills on hold right now. Park orders directly from POS using the &ldquo;Hold Order&rdquo; button.
          </div>
        ) : (
          <div className="space-y-2.5">
            {heldOrders.map((bill) => (
              <div
                key={bill.id}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-brand-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-brand-600">{bill.holdNumber}</span>
                    <h4 className="font-bold text-xs text-slate-800">{bill.customer}</h4>
                    {bill.notes && (
                      <Badge variant="neutral" size="sm">
                        {bill.notes}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {bill.items} items • {bill.time} • Total:{' '}
                    <strong className="text-slate-800 font-bold">₹{bill.total.toLocaleString()}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCancelHeldOrder(bill.id)}
                    className="text-rose-600 hover:bg-rose-50 border-rose-200 text-xs"
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleResumeHeldOrder(bill.id)}
                    className="text-xs font-bold"
                    leftIcon={<Play className="w-3.5 h-3.5" />}
                  >
                    Resume Bill
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Start Shift Modal */}
      <Modal
        isOpen={isStartShiftModalOpen}
        onClose={() => setIsStartShiftModalOpen(false)}
        title="Start Cashier Shift"
        subtitle={`Open cashier register session for ${activeOutletName}.`}
      >
        <form onSubmit={handleStartShift} className="space-y-4">
          {startShiftError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{startShiftError}</span>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-1">
            <p className="font-bold">Opening Cash Float</p>
            <p className="text-[11px] text-emerald-700">
              Enter the starting physical cash available in the cash drawer at the start of your shift.
            </p>
          </div>

          <Input
            label="Starting Cash Float (₹)"
            type="number"
            min="0"
            step="1"
            value={openingFloat}
            onChange={(e) => setOpeningFloat(parseFloat(e.target.value) || 0)}
            leftIcon={<Banknote className="w-4 h-4" />}
            required
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsStartShiftModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={isSubmittingShift}
              disabled={isSubmittingShift}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              leftIcon={<Unlock className="w-4 h-4" />}
            >
              Start Shift
            </Button>
          </div>
        </form>
      </Modal>

      {/* Close Shift Modal */}
      <Modal
        isOpen={isCloseShiftModalOpen}
        onClose={() => setIsCloseShiftModalOpen(false)}
        title="Close Cashier Shift"
        subtitle={`End active cashier session for ${activeOutletName} and reconcile cash drawer.`}
      >
        <form onSubmit={handleCloseShift} className="space-y-4">
          {closeShiftError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{closeShiftError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <p className="text-slate-500">Expected Cash in Drawer:</p>
              <p className="text-lg font-black text-slate-900">₹{shiftCash.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-slate-500">Digital / UPI Total:</p>
              <p className="text-lg font-black text-emerald-600">₹{shiftDigital.toLocaleString()}</p>
            </div>
          </div>

          <Input
            label="Actual Counted Cash (₹)"
            type="number"
            min="0"
            step="0.01"
            value={actualClosingCash}
            onChange={(e) => setActualClosingCash(parseFloat(e.target.value) || 0)}
            leftIcon={<Banknote className="w-4 h-4" />}
            required
          />

          {actualClosingCash !== shiftCash && (
            <p className="text-xs font-semibold p-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
              Cash Difference: ₹{(actualClosingCash - shiftCash).toFixed(2)}{' '}
              {actualClosingCash > shiftCash ? '(Overage)' : '(Shortage)'}
            </p>
          )}

          <Input
            label="Closing Notes (Optional)"
            placeholder="e.g. End of morning shift handover"
            value={closeShiftNotes}
            onChange={(e) => setCloseShiftNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCloseShiftModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={isSubmittingCloseShift}
              disabled={isSubmittingCloseShift}
              className="bg-rose-600 hover:bg-rose-700 text-white"
              leftIcon={<Lock className="w-4 h-4" />}
            >
              Confirm & Close Shift
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
