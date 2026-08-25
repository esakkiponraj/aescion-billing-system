import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  QrCode,
  Banknote,
  Percent,
  Receipt,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  PackageOpen,
  UtensilsCrossed,
  Printer,
  Clock,
  User,
  Coffee,
  ShoppingBag,
  Bike,
  FileText,
  ChevronRight,
  PauseCircle,
  Play,
  Lock,
  Unlock,
  Globe,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { useTenantStore } from '../../stores/tenantStore';
import { useAuthStore } from '../../stores/authStore';
import { apiRequest } from '../../services/api';
import { createRazorpayOrder, launchRazorpayCheckout } from '../../services/razorpay';
import { getBusinessTypeCapability } from '@aescion/types';

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  taxRate: number;
  category?: string;
}

interface ProductItem {
  id: string;
  name: string;
  sellingPrice: number;
  sku: string;
  category: string;
  taxRate: number;
}

type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
type OrderStatus = 'AVAILABLE' | 'OCCUPIED' | 'BILLED' | 'PAID';

interface RestaurantTable {
  id: string;
  tableNumber: string;
  name: string;
  capacity: number;
  status: OrderStatus;
  orderType: OrderType;
  orderNumber?: string;
  items: CartItem[];
  discountPercent: number;
  paymentMethod?: 'CASH' | 'UPI' | 'CARD' | 'CREDIT' | 'RAZORPAY';
  invoiceId?: string;
  invoiceData?: any;
  orderTime?: string;
}

export const PosPage: React.FC = () => {
  const { activeOrgName, activeOutletName, authorityLimits, roles, businessType } = useTenantStore();
  const { user, supportSession } = useAuthStore();

  const capabilities = getBusinessTypeCapability(businessType);

  if (user?.isSuperAdmin && !supportSession) {
    return <Navigate to="/super-admin" replace />;
  }

  // Accountant role or businesses with POS disabled must not access POS
  if (
    !capabilities.enabledModules.pos ||
    (roles.includes('ACCOUNTANT') &&
      !roles.includes('OWNER') &&
      !roles.includes('CASHIER') &&
      !roles.includes('MANAGER'))
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  const isRestaurant = Boolean(capabilities.enabledModules.tablesAndOrders);

  const [activeTab, setActiveTab] = useState<'POS' | 'TABLES'>(isRestaurant ? 'TABLES' : 'POS');
  const [selectedOrderType, setSelectedOrderType] = useState<OrderType>('DINE_IN');
  const [searchQuery, setSearchQuery] = useState('');
  const [catalog, setCatalog] = useState<ProductItem[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  // Fast Billing Cart State (for retail/fast POS)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'CREDIT' | 'RAZORPAY'>('UPI');

  // Restaurant Tables & Orders State
  const [tables, setTables] = useState<RestaurantTable[]>([
    { id: 'T-01', tableNumber: 'Table 1', name: 'Table 1 (Window)', capacity: 4, status: 'AVAILABLE', orderType: 'DINE_IN', items: [], discountPercent: 0 },
    { id: 'T-02', tableNumber: 'Table 2', name: 'Table 2 (Center)', capacity: 2, status: 'AVAILABLE', orderType: 'DINE_IN', items: [], discountPercent: 0 },
    { id: 'T-03', tableNumber: 'Table 3', name: 'Table 3 (Booth)', capacity: 6, status: 'AVAILABLE', orderType: 'DINE_IN', items: [], discountPercent: 0 },
    { id: 'T-04', tableNumber: 'Table 4', name: 'Table 4 (Patio)', capacity: 4, status: 'AVAILABLE', orderType: 'DINE_IN', items: [], discountPercent: 0 },
    { id: 'T-05', tableNumber: 'Table 5', name: 'Table 5 (Corner)', capacity: 2, status: 'AVAILABLE', orderType: 'DINE_IN', items: [], discountPercent: 0 },
    { id: 'T-06', tableNumber: 'Table 6', name: 'Table 6 (Family)', capacity: 8, status: 'AVAILABLE', orderType: 'DINE_IN', items: [], discountPercent: 0 },
    { id: 'TAK-01', tableNumber: 'Takeaway #1', name: 'Takeaway Counter #1', capacity: 1, status: 'AVAILABLE', orderType: 'TAKEAWAY', items: [], discountPercent: 0 },
    { id: 'DEL-01', tableNumber: 'Delivery #1', name: 'Zomato / Direct Delivery', capacity: 1, status: 'AVAILABLE', orderType: 'DELIVERY', items: [], discountPercent: 0 },
  ]);
  const [selectedTableId, setSelectedTableId] = useState<string>('T-01');

  // Receipt Modal State
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        setIsLoadingProducts(true);
        const products = await apiRequest<any[]>('/finance/products');
        setCatalog(
          (products || []).map((p) => ({
            id: p.id,
            name: p.name,
            sellingPrice: p.sellingPrice,
            sku: p.sku,
            category: p.category || 'General',
            taxRate: p.taxRate ?? 5,
          })),
        );
      } catch (e) {
        console.error('Failed to load products for POS:', e);
      } finally {
        setIsLoadingProducts(false);
      }
    };
    fetchCatalog();
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();

  // Shift & Held Orders State
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [isStartShiftModalOpen, setIsStartShiftModalOpen] = useState(false);
  const [openingFloat, setOpeningFloat] = useState(1000);
  const [isSubmittingShift, setIsSubmittingShift] = useState(false);

  const [heldOrdersList, setHeldOrdersList] = useState<any[]>([]);
  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false);
  const [isHoldingOrder, setIsHoldingOrder] = useState(false);
  const [holdNotes, setHoldNotes] = useState('');
  const [isHoldInputModalOpen, setIsHoldInputModalOpen] = useState(false);

  // Mobile POS view state ('catalog' | 'cart') for <1024px screens
  const [mobilePosView, setMobilePosView] = useState<'catalog' | 'cart'>('catalog');

  const fetchHeldOrders = useCallback(async () => {
    try {
      const orders = await apiRequest<any[]>('/finance/held-orders');
      setHeldOrdersList(orders || []);
    } catch (e) {
      console.warn('Failed to load held orders:', e);
    }
  }, []);

  const fetchCurrentShift = useCallback(async () => {
    try {
      const shift = await apiRequest<any>('/finance/shifts/current');
      setCurrentShift(shift);
    } catch (e) {
      console.warn('Failed to load current shift:', e);
    }
  }, []);

  useEffect(() => {
    fetchHeldOrders();
    fetchCurrentShift();
  }, [fetchHeldOrders, fetchCurrentShift]);

  // Check query params for resumeHeldId
  useEffect(() => {
    const resumeId = searchParams.get('resumeHeldId');
    if (resumeId) {
      apiRequest<any>(`/finance/held-orders/${resumeId}/restore`, { method: 'PUT' })
        .then((held) => {
          if (held && held.items) {
            setCart(held.items);
            setDiscountPercent(held.discountPercent || 0);
            setActiveTab('POS');
            setSearchParams({}, { replace: true });
            fetchHeldOrders();
          }
        })
        .catch((err) => console.warn('Could not auto-resume held order:', err));
    }
  }, [searchParams, setSearchParams, fetchHeldOrders]);

  const handleStartShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingShift(true);
    try {
      const shift = await apiRequest<any>('/finance/shifts/open', {
        method: 'POST',
        body: JSON.stringify({
          openingFloat: Number(openingFloat),
          openingCash: Number(openingFloat),
        }),
      });
      setCurrentShift(shift);
      setIsStartShiftModalOpen(false);
      window.dispatchEvent(new CustomEvent('aescion:shift-updated'));
    } catch (err: any) {
      alert(err.message || 'Failed to start shift.');
    } finally {
      setIsSubmittingShift(false);
    }
  };

  const handleHoldOrder = async () => {
    if (currentCart.length === 0) return;
    setIsHoldingOrder(true);
    try {
      const payload = {
        items: currentCart,
        discountPercent: currentDiscount,
        total,
        customerName: activeTab === 'TABLES' ? activeTable.name : 'Walk-in Customer',
        tableNumber: activeTab === 'TABLES' ? activeTable.tableNumber : undefined,
        orderType: activeTab === 'TABLES' ? activeTable.orderType : 'RETAIL',
        notes: holdNotes || (activeTab === 'TABLES' ? `Parked ${activeTable.tableNumber}` : 'Parked Counter Cart'),
      };

      const res = await apiRequest<any>('/finance/held-orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (activeTab === 'TABLES') {
        handleResetTable(selectedTableId);
      } else {
        setCart([]);
        setDiscountPercent(0);
      }
      setHoldNotes('');
      setIsHoldInputModalOpen(false);

      // Dispatch real-time events
      window.dispatchEvent(new CustomEvent('aescion:held-order-updated', { detail: res }));
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const channel = new BroadcastChannel('aescion_events');
          channel.postMessage({ type: 'HELD_ORDER_UPDATED', data: res, timestamp: Date.now() });
          channel.close();
        } catch {}
      }

      await fetchHeldOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to hold order.');
    } finally {
      setIsHoldingOrder(false);
    }
  };

  const handleResumeHeldOrder = async (heldId: string) => {
    try {
      const held = await apiRequest<any>(`/finance/held-orders/${heldId}/restore`, { method: 'PUT' });
      if (held && held.items) {
        if (activeTab === 'TABLES') {
          setTables((prev) =>
            prev.map((t) => {
              if (t.id === selectedTableId) {
                return {
                  ...t,
                  items: held.items,
                  discountPercent: held.discountPercent || 0,
                  status: 'OCCUPIED',
                };
              }
              return t;
            }),
          );
        } else {
          setCart(held.items);
          setDiscountPercent(held.discountPercent || 0);
        }
      }
      setIsHeldModalOpen(false);

      // Dispatch real-time events
      window.dispatchEvent(new CustomEvent('aescion:held-order-updated', { detail: held }));
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const channel = new BroadcastChannel('aescion_events');
          channel.postMessage({ type: 'HELD_ORDER_UPDATED', data: held, timestamp: Date.now() });
          channel.close();
        } catch {}
      }

      await fetchHeldOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to resume held order.');
    }
  };

  const handleCancelHeldOrder = async (heldId: string) => {
    if (!confirm('Are you sure you want to cancel this held order?')) return;
    try {
      await apiRequest(`/finance/held-orders/${heldId}`, { method: 'DELETE' });
      window.dispatchEvent(new CustomEvent('aescion:held-order-updated'));
      await fetchHeldOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel held order.');
    }
  };

  const activeTable = tables.find((t) => t.id === selectedTableId) || tables[0];
  const currentCart = activeTab === 'TABLES' ? activeTable?.items || [] : cart;
  const currentDiscount = activeTab === 'TABLES' ? activeTable?.discountPercent || 0 : discountPercent;

  const filteredCatalog = catalog.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.category.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const addToActiveOrder = (item: ProductItem) => {
    if (activeTab === 'TABLES') {
      if (activeTable.status === 'PAID') {
        alert('This table order is already paid. Please reset the table for the next customer first.');
        return;
      }
      setTables((prev) =>
        prev.map((t) => {
          if (t.id === selectedTableId) {
            const existing = t.items.find((p) => p.id === item.id);
            const updatedItems = existing
              ? t.items.map((p) => (p.id === item.id ? { ...p, qty: p.qty + 1 } : p))
              : [...t.items, { id: item.id, name: item.name, price: item.sellingPrice, qty: 1, taxRate: item.taxRate, category: item.category }];
            return {
              ...t,
              items: updatedItems,
              status: t.status === 'AVAILABLE' ? 'OCCUPIED' : t.status,
              orderTime: t.orderTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              orderNumber: t.orderNumber || `ORD-${Math.floor(100 + Math.random() * 900)}`,
            };
          }
          return t;
        }),
      );
    } else {
      setCart((prev) => {
        const existing = prev.find((p) => p.id === item.id);
        if (existing) {
          return prev.map((p) => (p.id === item.id ? { ...p, qty: p.qty + 1 } : p));
        }
        return [...prev, { id: item.id, name: item.name, price: item.sellingPrice, qty: 1, taxRate: item.taxRate, category: item.category }];
      });
    }
  };

  const updateActiveQty = (id: string, delta: number) => {
    if (activeTab === 'TABLES') {
      if (activeTable.status === 'PAID') return;
      setTables((prev) =>
        prev.map((t) => {
          if (t.id === selectedTableId) {
            const updated = t.items
              .map((p) => {
                if (p.id === id) {
                  const newQty = p.qty + delta;
                  return newQty > 0 ? { ...p, qty: newQty } : null;
                }
                return p;
              })
              .filter(Boolean) as CartItem[];
            return {
              ...t,
              items: updated,
              status: updated.length === 0 ? 'AVAILABLE' : t.status,
            };
          }
          return t;
        }),
      );
    } else {
      setCart((prev) =>
        prev
          .map((p) => {
            if (p.id === id) {
              const newQty = p.qty + delta;
              return newQty > 0 ? { ...p, qty: newQty } : null;
            }
            return p;
          })
          .filter(Boolean) as CartItem[],
      );
    }
  };

  const setOrderDiscount = (percent: number) => {
    if (activeTab === 'TABLES') {
      setTables((prev) =>
        prev.map((t) => (t.id === selectedTableId ? { ...t, discountPercent: percent } : t)),
      );
    } else {
      setDiscountPercent(percent);
    }
  };

  const subtotal = currentCart.reduce((acc, item) => acc + item.price * item.qty, 0);
  const discountAmount = (subtotal * currentDiscount) / 100;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = currentCart.reduce((acc, item) => {
    const itemSub = item.price * item.qty;
    const itemDisc = (itemSub * currentDiscount) / 100;
    return acc + ((itemSub - itemDisc) * item.taxRate) / 100;
  }, 0);
  const total = taxableAmount + taxAmount;

  const isExceedingDiscount = currentDiscount > authorityLimits.maxDiscountPercent;

  // Checkout and Generate Real Receipt
  const handleCompletePayment = async () => {
    if (currentCart.length === 0) return;

    if (isExceedingDiscount) {
      try {
        await apiRequest('/approvals', {
          method: 'POST',
          body: JSON.stringify({
            approvalType: 'EXCESSIVE_DISCOUNT',
            resourceType: 'SALE',
            requestedValue: `${currentDiscount}% Discount (₹${discountAmount.toFixed(2)})`,
            reason: `Discount of ${currentDiscount}% exceeds authorized limit of ${authorityLimits.maxDiscountPercent}%`,
          }),
        });
        alert(`Discount of ${currentDiscount}% exceeds your authorized limit (${authorityLimits.maxDiscountPercent}%). Approval request dispatched to Manager.`);
      } catch (err: any) {
        alert(err.message || 'Failed to submit discount approval request.');
      }
      return;
    }

    setIsSubmittingCheckout(true);

    try {
      const payload = {
        items: currentCart.map((item) => ({
          productId: item.id,
          description: item.name,
          quantity: item.qty,
          unitPrice: item.price,
          taxRate: item.taxRate,
        })),
        discountPercent: currentDiscount,
        paymentMethod: selectedPaymentMethod,
        tableNumber: activeTab === 'TABLES' ? activeTable.tableNumber : undefined,
        orderType: activeTab === 'TABLES' ? activeTable.orderType : 'RETAIL',
        notes: activeTab === 'TABLES' ? `${activeTable.orderType} — ${activeTable.tableNumber}` : 'Fast Retail Sale',
      };

      const savedInvoice = await apiRequest<any>('/finance/sales-invoices', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (selectedPaymentMethod === 'RAZORPAY') {
        try {
          const orderData = await createRazorpayOrder({ invoiceId: savedInvoice.id });
          await launchRazorpayCheckout({
            orderData,
            onSuccess: (verifiedResult) => {
              const fullReceipt = {
                ...savedInvoice,
                paymentStatus: 'PAID',
                paidAmount: savedInvoice.totalAmount,
                outstandingAmount: 0,
                receiptNumber: verifiedResult.receiptNumber,
                tableNumber: activeTab === 'TABLES' ? activeTable.tableNumber : null,
                orderType: activeTab === 'TABLES' ? activeTable.orderType : 'RETAIL',
                cashierName: `${user?.firstName || 'Staff'} ${user?.lastName || ''}`.trim(),
                paymentMethod: 'RAZORPAY',
              };

              try {
                window.dispatchEvent(new CustomEvent('aescion:sale-completed', { detail: fullReceipt }));
                if (typeof BroadcastChannel !== 'undefined') {
                  const channel = new BroadcastChannel('aescion_events');
                  channel.postMessage({ type: 'SALE_COMPLETED', data: fullReceipt, timestamp: Date.now() });
                  channel.close();
                }
              } catch (evtErr) {
                console.warn('Real-time event broadcast error:', evtErr);
              }

              if (activeTab === 'TABLES') {
                setTables((prev) =>
                  prev.map((t) => {
                    if (t.id === selectedTableId) {
                      return {
                        ...t,
                        status: 'PAID',
                        paymentMethod: 'RAZORPAY',
                        invoiceId: savedInvoice.id,
                        invoiceData: fullReceipt,
                      };
                    }
                    return t;
                  }),
                );
              } else {
                setCart([]);
                setDiscountPercent(0);
              }

              setReceiptData(fullReceipt);
              setIsReceiptModalOpen(true);
            },
            onError: (payErr) => {
              alert(`Razorpay checkout failed: ${payErr.message || 'Payment was declined or cancelled.'}`);
            },
            onDismiss: () => {
              console.log('Razorpay modal closed by user.');
            },
          });
          return;
        } catch (rzpErr: any) {
          alert(`Could not initiate Razorpay checkout: ${rzpErr.message}`);
          return;
        }
      }

      const fullReceipt = {
        ...savedInvoice,
        tableNumber: activeTab === 'TABLES' ? activeTable.tableNumber : null,
        orderType: activeTab === 'TABLES' ? activeTable.orderType : 'RETAIL',
        cashierName: `${user?.firstName || 'Staff'} ${user?.lastName || ''}`.trim(),
        paymentMethod: selectedPaymentMethod,
      };

      // Broadcast real-time sale completion event to live Owner Dashboard across components and tabs
      try {
        window.dispatchEvent(new CustomEvent('aescion:sale-completed', { detail: fullReceipt }));
        if (typeof BroadcastChannel !== 'undefined') {
          const channel = new BroadcastChannel('aescion_events');
          channel.postMessage({ type: 'SALE_COMPLETED', data: fullReceipt, timestamp: Date.now() });
          channel.close();
        }
      } catch (evtErr) {
        console.warn('Real-time event broadcast error:', evtErr);
      }

      if (activeTab === 'TABLES') {
        setTables((prev) =>
          prev.map((t) => {
            if (t.id === selectedTableId) {
              return {
                ...t,
                status: 'PAID',
                paymentMethod: selectedPaymentMethod,
                invoiceId: savedInvoice.id,
                invoiceData: fullReceipt,
              };
            }
            return t;
          }),
        );
      } else {
        setCart([]);
        setDiscountPercent(0);
      }

      setReceiptData(fullReceipt);
      setIsReceiptModalOpen(true);
    } catch (err: any) {
      console.error('Payment checkout failed:', err);
      alert(err.message || 'Payment processing failed.');
    } finally {
      setIsSubmittingCheckout(false);
    }
  };

  const handleViewReceipt = (table: RestaurantTable) => {
    if (table.invoiceData) {
      setReceiptData(table.invoiceData);
      setIsReceiptModalOpen(true);
    } else if (table.invoiceId) {
      apiRequest(`/finance/sales-invoices/${table.invoiceId}`)
        .then((data) => {
          setReceiptData({
            ...data,
            tableNumber: table.tableNumber,
            orderType: table.orderType,
            cashierName: `${user?.firstName || 'Staff'} ${user?.lastName || ''}`.trim(),
          });
          setIsReceiptModalOpen(true);
        })
        .catch((e) => alert('Failed to retrieve invoice details.'));
    }
  };

  const handleResetTable = (tableId: string) => {
    setTables((prev) =>
      prev.map((t) => {
        if (t.id === tableId) {
          return {
            ...t,
            status: 'AVAILABLE',
            items: [],
            discountPercent: 0,
            invoiceId: undefined,
            invoiceData: undefined,
            orderNumber: undefined,
            orderTime: undefined,
          };
        }
        return t;
      }),
    );
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="h-full lg:h-[calc(100vh-6.5rem)] flex flex-col gap-3 sm:gap-4 max-w-[1700px] mx-auto overflow-hidden">
      {/* Top Header Bar with Mode Switchers */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl bg-white border border-slate-200 shadow-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600 shrink-0">
            {isRestaurant ? <UtensilsCrossed className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
              <span>{isRestaurant ? 'Tables & Orders Billing' : 'POS Register'}</span>
              <Badge variant="brand" size="sm">
                {activeOutletName}
              </Badge>
            </h2>
            <p className="text-[11px] text-slate-500 truncate">
              Cashier: <strong className="text-slate-800">{user?.firstName} {user?.lastName}</strong> • Max Discount: <strong className="text-brand-600">{authorityLimits.maxDiscountPercent}%</strong>
            </p>
          </div>
        </div>

        {/* Shift and Held Orders Controls */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsHeldModalOpen(true)}
            className="text-xs font-bold text-orange-600 border-orange-200 hover:bg-orange-50"
            leftIcon={<PauseCircle className="w-4 h-4 text-orange-500" />}
          >
            Held ({heldOrdersList.length})
          </Button>

          {currentShift ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Shift Active</span>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => setIsStartShiftModalOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
              leftIcon={<Unlock className="w-3.5 h-3.5" />}
            >
              Start Shift
            </Button>
          )}

          {/* View Switcher if restaurant business */}
          {isRestaurant && (
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 border border-slate-200">
              <button
                onClick={() => setActiveTab('TABLES')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                  activeTab === 'TABLES'
                    ? 'bg-white text-brand-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UtensilsCrossed className="w-3.5 h-3.5 text-brand-600" />
                <span className="hidden xs:inline sm:inline">Tables</span>
              </button>
              <button
                onClick={() => setActiveTab('POS')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                  activeTab === 'POS'
                    ? 'bg-white text-brand-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5 text-orange-500" />
                <span className="hidden xs:inline sm:inline">Direct POS</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Screen Switcher Tab (< lg) */}
      <div className="lg:hidden flex items-center p-1 bg-slate-200/80 rounded-xl shrink-0">
        <button
          type="button"
          onClick={() => setMobilePosView('catalog')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            mobilePosView === 'catalog'
              ? 'bg-white text-brand-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {isRestaurant && activeTab === 'TABLES' ? <UtensilsCrossed className="w-3.5 h-3.5" /> : <PackageOpen className="w-3.5 h-3.5" />}
          <span>{isRestaurant && activeTab === 'TABLES' ? 'Floor & Menu' : 'Product Catalog'}</span>
        </button>
        <button
          type="button"
          onClick={() => setMobilePosView('cart')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            mobilePosView === 'cart'
              ? 'bg-white text-brand-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Cart ({currentCart.length}) • ₹{total.toFixed(2)}</span>
        </button>
      </div>

      {/* Main Layout Grid */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden">
        {/* Left Column: Tables Grid OR Menu Catalog */}
        <div className={`flex-1 flex-col gap-4 min-w-0 min-h-0 overflow-hidden ${mobilePosView === 'catalog' ? 'flex' : 'hidden lg:flex'}`}>
          {/* If in TABLES mode, show table filter bar and floor plan */}
          {activeTab === 'TABLES' && (
            <div className="space-y-3 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {(['DINE_IN', 'TAKEAWAY', 'DELIVERY'] as OrderType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedOrderType(type)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border whitespace-nowrap ${
                        selectedOrderType === type
                          ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {type === 'DINE_IN' && <Coffee className="w-3.5 h-3.5 text-brand-600" />}
                      {type === 'TAKEAWAY' && <ShoppingBag className="w-3.5 h-3.5 text-orange-500" />}
                      {type === 'DELIVERY' && <Bike className="w-3.5 h-3.5 text-sky-600" />}
                      <span>{type.replace('_', ' ')}</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Available</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> Occupied</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500" /> Paid</span>
                </div>
              </div>

              {/* Table Selector Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {tables
                  .filter((t) => t.orderType === selectedOrderType)
                  .map((table) => {
                    const isSelected = table.id === selectedTableId;
                    const tableTotal = table.items.reduce((a, b) => a + b.price * b.qty, 0);

                    return (
                      <div
                        key={table.id}
                        onClick={() => setSelectedTableId(table.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none relative ${
                          isSelected
                            ? 'bg-brand-50/70 border-brand-500 shadow-sm ring-1 ring-brand-500/40'
                            : table.status === 'PAID'
                              ? 'bg-sky-50/70 border-sky-200 hover:border-sky-300'
                              : table.status === 'OCCUPIED'
                                ? 'bg-orange-50/70 border-orange-200 hover:border-orange-300'
                                : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-sm text-slate-900">{table.tableNumber}</span>
                          <Badge
                            variant={
                              table.status === 'PAID'
                                ? 'info'
                                : table.status === 'OCCUPIED'
                                  ? 'warning'
                                  : 'success'
                            }
                            size="sm"
                          >
                            {table.status}
                          </Badge>
                        </div>

                        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-slate-500">{table.items.length} item(s)</span>
                          <span className="font-bold text-slate-800">
                            {tableTotal > 0 ? `₹${tableTotal}` : 'Empty'}
                          </span>
                        </div>

                        {table.status === 'PAID' && (
                          <div className="mt-2 flex gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewReceipt(table);
                              }}
                              className="flex-1 py-1 rounded bg-sky-100 hover:bg-sky-200 text-sky-800 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors"
                            >
                              <Receipt className="w-3 h-3" /> View Receipt
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResetTable(table.id);
                              }}
                              className="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] transition-colors"
                              title="Free table for next customer"
                            >
                              Reset
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Menu Catalog Search & Grid */}
          <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200 p-3.5 overflow-hidden shadow-card">
            {/* Search Input */}
            <div className="relative mb-3 shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search menu items, food, drinks, barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:bg-white"
              />
            </div>

            {/* Catalog Grid */}
            <div className="flex-1 overflow-y-auto pr-1">
              {isLoadingProducts ? (
                <div className="h-48 flex items-center justify-center text-xs text-slate-500">
                  Loading menu items...
                </div>
              ) : filteredCatalog.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <PackageOpen className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-xs font-bold text-slate-700">No items found</p>
                  <p className="text-[11px] text-slate-400">Add products to your catalog to start ordering</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
                  {filteredCatalog.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => addToActiveOrder(product)}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-brand-500 hover:bg-brand-50/40 transition-all cursor-pointer flex flex-col justify-between group active:scale-95 select-none shadow-2xs"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono text-slate-500">{product.category}</span>
                          <span className="text-[10px] text-slate-400">GST {product.taxRate}%</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 group-hover:text-brand-700 line-clamp-2">
                          {product.name}
                        </h4>
                      </div>

                      <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-slate-200">
                        <span className="text-xs font-black text-brand-600">₹{product.sellingPrice}</span>
                        <div className="w-5 h-5 rounded bg-brand-100 text-brand-700 group-hover:bg-brand-600 group-hover:text-white flex items-center justify-center transition-colors font-bold text-xs">
                          +
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile Bottom Floating Checkout Button */}
            {mobilePosView === 'catalog' && currentCart.length > 0 && (
              <div className="lg:hidden shrink-0 pt-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMobilePosView('cart')}
                  className="w-full py-2.5 px-4 rounded-xl bg-brand-600 text-white font-bold text-xs flex items-center justify-between shadow-lg shadow-brand-500/25"
                >
                  <span className="flex items-center gap-1.5">
                    <ShoppingCart className="w-4 h-4" />
                    <span>{currentCart.length} item(s) in Cart</span>
                  </span>
                  <span className="flex items-center gap-1 font-mono">
                    <span>₹{total.toFixed(2)} • Checkout</span>
                    <span>&rarr;</span>
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Order / Bill & Payment Pad */}
        <div className={`w-full lg:w-96 bg-white rounded-xl border border-slate-200 flex-col shrink-0 overflow-hidden shadow-card min-h-0 ${mobilePosView === 'cart' ? 'flex' : 'hidden lg:flex'}`}>
          {/* Order Header */}
          <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-brand-600" />
              <div>
                <h3 className="font-bold text-xs text-slate-900">
                  {activeTab === 'TABLES' ? `${activeTable.tableNumber} Bill` : 'Current Bill'}
                </h3>
                {activeTab === 'TABLES' && (
                  <p className="text-[10px] text-slate-500">
                    Status: <strong className="text-slate-800">{activeTable.status}</strong>
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-mono">
                {currentCart.length} item(s)
              </span>
              <button
                type="button"
                onClick={() => setMobilePosView('catalog')}
                className="lg:hidden px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[11px] font-semibold"
              >
                + Add More
              </button>
            </div>
          </div>

          {/* Order Items List */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
            {currentCart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <ShoppingCart className="w-8 h-8 mb-2 stroke-1 text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">No items added</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Select menu items from the left</p>
              </div>
            ) : (
              currentCart.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-500">₹{item.price} each (GST {item.taxRate}%)</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => updateActiveQty(item.id, -1)}
                      disabled={activeTab === 'TABLES' && activeTable.status === 'PAID'}
                      className="w-5 h-5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center text-xs disabled:opacity-50"
                    >
                      -
                    </button>
                    <span className="w-5 text-center font-bold text-xs text-slate-900">{item.qty}</span>
                    <button
                      onClick={() => updateActiveQty(item.id, 1)}
                      disabled={activeTab === 'TABLES' && activeTable.status === 'PAID'}
                      className="w-5 h-5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center text-xs disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>

                  <span className="font-bold text-slate-900 min-w-[50px] text-right">
                    ₹{(item.price * item.qty).toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Calculations & Checkout */}
          <div className="p-3.5 border-t border-slate-200 bg-slate-50/90 space-y-2.5 shrink-0">
            {/* Discount Control */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 flex items-center gap-1">
                <Percent className="w-3 h-3 text-orange-500" /> Discount:
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={currentDiscount}
                  onChange={(e) => setOrderDiscount(parseFloat(e.target.value) || 0)}
                  disabled={activeTab === 'TABLES' && activeTable.status === 'PAID'}
                  className="w-14 px-2 py-0.5 rounded-md bg-white border border-slate-300 text-xs text-right font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <span className="text-slate-500">%</span>
              </div>
            </div>

            {isExceedingDiscount && (
              <div className="p-2 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 text-[11px] flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>&gt; {authorityLimits.maxDiscountPercent}% requires Manager Approval</span>
              </div>
            )}

            {/* Calculations Breakdown */}
            <div className="space-y-1 text-xs border-t border-slate-200 pt-2">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {currentDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount ({currentDiscount}%)</span>
                  <span>-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Tax (GST)</span>
                <span>₹{taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
                <span>Total Payable</span>
                <span className="text-brand-600">₹{total.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            {(!activeTable || activeTable.status !== 'PAID') && (
              <div className="grid grid-cols-5 gap-1 pt-1">
                {[
                  { id: 'CASH', label: 'Cash', icon: <Banknote className="w-3 h-3" /> },
                  { id: 'UPI', label: 'UPI QR', icon: <QrCode className="w-3 h-3" /> },
                  { id: 'CARD', label: 'Card', icon: <CreditCard className="w-3 h-3" /> },
                  { id: 'RAZORPAY', label: 'Razorpay', icon: <Globe className="w-3 h-3 text-blue-600" /> },
                  { id: 'CREDIT', label: 'Credit', icon: <Receipt className="w-3 h-3" /> },
                ].map((pm) => (
                  <button
                    key={pm.id}
                    onClick={() => setSelectedPaymentMethod(pm.id as any)}
                    className={`p-1 rounded-md border text-[9px] font-bold flex flex-col items-center gap-0.5 transition-all ${
                      selectedPaymentMethod === pm.id
                        ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {pm.icon}
                    <span>{pm.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            {activeTab === 'TABLES' && activeTable.status === 'PAID' ? (
              <div className="space-y-2">
                <Button
                  size="md"
                  className="w-full text-xs font-bold"
                  onClick={() => handleViewReceipt(activeTable)}
                  leftIcon={<Receipt className="w-4 h-4" />}
                >
                  View / Print Receipt
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => handleResetTable(activeTable.id)}
                >
                  Clear & Free Table
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => setIsHoldInputModalOpen(true)}
                  disabled={currentCart.length === 0 || isHoldingOrder}
                  isLoading={isHoldingOrder}
                  className="px-3 text-orange-600 border-orange-200 hover:bg-orange-50 shrink-0"
                  title="Park / Hold current cart"
                >
                  <PauseCircle className="w-5 h-5" />
                </Button>
                <Button
                  size="lg"
                  className="flex-1 text-sm font-black py-3 shadow-md shadow-brand-500/20"
                  onClick={handleCompletePayment}
                  disabled={currentCart.length === 0 || isSubmittingCheckout}
                  isLoading={isSubmittingCheckout}
                >
                  {isExceedingDiscount
                    ? 'Request Approval & Pay'
                    : `Charge ₹${total.toFixed(2)}`}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Held Orders Modal */}
      <Modal
        isOpen={isHeldModalOpen}
        onClose={() => setIsHeldModalOpen(false)}
        title="Parked Bills & Held Orders"
        subtitle="Resume or cancel orders placed on hold for this cashier."
        maxWidth="lg"
      >
        <div className="space-y-4">
          {heldOrdersList.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No orders are currently on hold.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {heldOrdersList.map((held) => (
                <div
                  key={held.id}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-brand-600">{held.holdNumber}</span>
                      <h4 className="font-bold text-xs text-slate-800">{held.customerName || 'Walk-in'}</h4>
                      {held.notes && (
                        <Badge variant="neutral" size="sm">
                          {held.notes}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {held.itemCount || 1} items •{' '}
                      {new Date(held.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Total:{' '}
                      <strong className="text-slate-900 font-bold">₹{held.totalAmount?.toFixed(2)}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCancelHeldOrder(held.id)}
                      className="text-rose-600 hover:bg-rose-50 border-rose-200 text-xs"
                      leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleResumeHeldOrder(held.id)}
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

          <div className="flex justify-end pt-3 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={() => setIsHeldModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Hold Order Prompt Modal */}
      <Modal
        isOpen={isHoldInputModalOpen}
        onClose={() => setIsHoldInputModalOpen(false)}
        title="Park / Hold Current Order"
        subtitle="Save this customer cart to hold queue so you can bill the next customer."
      >
        <div className="space-y-4">
          <Input
            label="Park Notes / Reference (Optional)"
            placeholder="e.g. Customer stepped away to get cash"
            value={holdNotes}
            onChange={(e) => setHoldNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={() => setIsHoldInputModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleHoldOrder}
              isLoading={isHoldingOrder}
              className="bg-orange-600 hover:bg-orange-700 text-white"
              leftIcon={<PauseCircle className="w-4 h-4" />}
            >
              Confirm & Hold Cart
            </Button>
          </div>
        </div>
      </Modal>

      {/* Start Shift Modal */}
      <Modal
        isOpen={isStartShiftModalOpen}
        onClose={() => setIsStartShiftModalOpen(false)}
        title="Start Cashier Shift"
        subtitle={`Open cashier register session for ${activeOutletName}.`}
      >
        <form onSubmit={handleStartShift} className="space-y-4">
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              leftIcon={<Unlock className="w-4 h-4" />}
            >
              Start Shift
            </Button>
          </div>
        </form>
      </Modal>

      {/* Complete Professional Real Receipt Modal */}
      <Modal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        title="Tax Invoice & Receipt"
        subtitle="Official customer payment receipt generated from transaction."
        maxWidth="md"
      >
        {receiptData && (
          <div className="space-y-4">
            {/* Printable Receipt Container */}
            <div
              id="printable-receipt"
              className="p-5 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-mono space-y-3 shadow-xs"
            >
              {/* Receipt Header */}
              <div className="text-center pb-3 border-b border-dashed border-slate-300 space-y-1">
                <h2 className="text-base font-black text-slate-900 tracking-wider uppercase">
                  {receiptData.organization?.name || activeOrgName || 'AESCION ENTERPRISES'}
                </h2>
                <p className="text-slate-600 text-[11px]">
                  {receiptData.outlet?.name || activeOutletName} Branch
                </p>
                {receiptData.outlet?.phone && (
                  <p className="text-slate-500 text-[10px]">Tel: {receiptData.outlet.phone}</p>
                )}
                <div className="inline-block px-2 py-0.5 rounded bg-brand-50 text-brand-700 text-[10px] font-bold uppercase mt-1 border border-brand-200">
                  TAX INVOICE & PAYMENT RECEIPT
                </div>
              </div>

              {/* Invoice Metadata */}
              <div className="grid grid-cols-2 gap-2 text-[11px] pb-3 border-b border-dashed border-slate-300">
                <div>
                  <span className="text-slate-500">Invoice No:</span>{' '}
                  <strong className="text-slate-900">{receiptData.invoiceNumber}</strong>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Date:</span>{' '}
                  <strong className="text-slate-900">
                    {new Date(receiptData.createdAt || Date.now()).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </strong>
                </div>
                {receiptData.tableNumber && (
                  <div>
                    <span className="text-slate-500">Table / Type:</span>{' '}
                    <strong className="text-brand-600">{receiptData.tableNumber}</strong>
                  </div>
                )}
                <div className={receiptData.tableNumber ? 'text-right' : ''}>
                  <span className="text-slate-500">Cashier:</span>{' '}
                  <strong className="text-slate-800">{receiptData.cashierName || user?.firstName || 'Staff'}</strong>
                </div>
              </div>

              {/* Items Line Breakdown */}
              <div className="space-y-1 pb-3 border-b border-dashed border-slate-300 text-[11px]">
                <div className="grid grid-cols-12 font-bold text-slate-500 pb-1">
                  <span className="col-span-6">Item</span>
                  <span className="col-span-2 text-center">Qty</span>
                  <span className="col-span-4 text-right">Price</span>
                </div>
                {(receiptData.items || []).map((it: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-12 text-slate-800">
                    <span className="col-span-6 truncate">{it.description || it.product?.name || 'Item'}</span>
                    <span className="col-span-2 text-center">{it.quantity}</span>
                    <span className="col-span-4 text-right">₹{it.totalAmount?.toFixed(2) || (it.quantity * it.unitPrice).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Financial Breakdown */}
              <div className="space-y-1 text-[11px] pb-3 border-b border-dashed border-slate-300">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>₹{receiptData.subtotal?.toFixed(2)}</span>
                </div>
                {receiptData.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Discount:</span>
                    <span>-₹{receiptData.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Taxable Value:</span>
                  <span>₹{receiptData.taxableAmount?.toFixed(2)}</span>
                </div>
                {receiptData.cgstAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>CGST:</span>
                    <span>₹{receiptData.cgstAmount.toFixed(2)}</span>
                  </div>
                )}
                {receiptData.sgstAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>SGST:</span>
                    <span>₹{receiptData.sgstAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
                  <span>Grand Total:</span>
                  <span className="text-brand-600">₹{receiptData.totalAmount?.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="space-y-1 text-[11px] pt-1">
                <div className="flex justify-between text-slate-600">
                  <span>Payment Mode:</span>
                  <strong className="text-slate-900 uppercase">{receiptData.paymentMethod || 'PAID'}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Amount Paid:</span>
                  <strong className="text-emerald-600">₹{receiptData.paidAmount?.toFixed(2) || receiptData.totalAmount?.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Change / Due:</span>
                  <span>₹{receiptData.outstandingAmount?.toFixed(2) || '0.00'}</span>
                </div>
              </div>

              {/* Receipt Footer Note */}
              <div className="text-center pt-3 text-[10px] text-slate-400">
                <p>Thank you for your business!</p>
                <p className="font-mono">Powered by AESCION Retail & Hospitality Engine</p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsReceiptModalOpen(false)}
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={handlePrintReceipt}
                leftIcon={<Printer className="w-4 h-4" />}
              >
                Print Receipt
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
