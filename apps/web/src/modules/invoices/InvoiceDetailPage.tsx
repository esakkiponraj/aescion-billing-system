import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CreditCard,
  ArrowLeft,
  Printer,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileCheck,
  Building,
  User,
  Shield,
  Clock,
  ArrowRight,
  Receipt as ReceiptIcon,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { createRazorpayOrder, launchRazorpayCheckout } from '../../services/razorpay';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { DocumentPrintModal, DocumentPrintData } from '../../components/common/DocumentPrintModal';

export const InvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, organizations } = useAuthStore();
  const { activeOrgId, roles } = useTenantStore();
  const currentOrg = organizations.find((o) => o.organizationId === activeOrgId);

  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Payment Recording Modal State
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<
    'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER' | 'RAZORPAY'
  >('RAZORPAY');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Cancel Invoice Modal State
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Print Modal State
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  const fetchInvoice = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await apiRequest(`/finance/invoices/${id}`);
      setInvoice(data);
      if (data) {
        setPaymentAmount(data.outstandingAmount || 0);
      }
    } catch (err: any) {
      console.error('Failed to load invoice', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentAmount <= 0) {
      alert('Payment amount must be greater than zero');
      return;
    }
    if (paymentAmount > invoice.outstandingAmount) {
      alert(`Payment amount cannot exceed outstanding balance of ₹${invoice.outstandingAmount.toFixed(2)}`);
      return;
    }

    if (paymentMethod === 'RAZORPAY') {
      try {
        setRecordingPayment(true);
        const orderData = await createRazorpayOrder({
          invoiceId: invoice.id,
          amount: Number(paymentAmount),
          notes: paymentNotes ? { notes: paymentNotes } : undefined,
        });

        await launchRazorpayCheckout({
          orderData,
          onSuccess: (verifiedResult) => {
            setIsPaymentOpen(false);
            setReferenceNumber('');
            setPaymentNotes('');
            fetchInvoice();
            alert(`Payment Successful! Receipt #${verifiedResult.receiptNumber} generated.`);
          },
          onError: (payErr) => {
            alert(`Razorpay payment failed: ${payErr.message || 'Payment was declined or cancelled.'}`);
          },
          onDismiss: () => {
            console.log('Razorpay checkout closed by user.');
          },
        });
      } catch (err: any) {
        alert(err.message || 'Failed to initiate Razorpay checkout');
      } finally {
        setRecordingPayment(false);
      }
      return;
    }

    try {
      setRecordingPayment(true);
      const result = await apiRequest(`/finance/invoices/${id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(paymentAmount),
          paymentMethod,
          referenceNumber: referenceNumber || undefined,
          notes: paymentNotes || undefined,
        }),
      });

      setIsPaymentOpen(false);
      setReferenceNumber('');
      setPaymentNotes('');
      fetchInvoice();
    } catch (err: any) {
      alert(err.message || 'Failed to record payment');
    } finally {
      setRecordingPayment(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!cancelReason.trim()) {
      alert('Please provide a reason for cancelling this invoice.');
      return;
    }

    try {
      setCancelling(true);
      await apiRequest(`/finance/invoices/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason }),
      });
      setIsCancelOpen(false);
      fetchInvoice();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel invoice');
    } finally {
      setCancelling(false);
    }
  };

  if (loading || !invoice) {
    return (
      <div className="p-12 text-center text-slate-400">
        <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-semibold">Loading invoice details...</p>
      </div>
    );
  }

  const isFullyPaid = invoice.paymentStatus === 'PAID' || invoice.outstandingAmount <= 0;
  const isCancelled = invoice.paymentStatus === 'CANCELLED';

  const statusColors: Record<string, string> = {
    PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    PARTIALLY_PAID: 'bg-blue-50 text-blue-700 border-blue-200',
    UNPAID: 'bg-amber-50 text-amber-700 border-amber-200',
    OVERDUE: 'bg-rose-50 text-rose-700 border-rose-200',
    CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
  };

  const printData: DocumentPrintData = {
    type: 'INVOICE',
    title: 'Tax Invoice',
    documentNumber: invoice.invoiceNumber,
    date: new Date(invoice.createdAt).toLocaleDateString(),
    dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : undefined,
    status: invoice.paymentStatus,
    businessName: currentOrg?.organizationName || 'Business',
    businessAddress: undefined,
    outletName: invoice.outlet?.name,
    customerName: invoice.customer?.name || 'Walk-in Customer',
    customerPhone: invoice.customer?.phone || undefined,
    customerEmail: invoice.customer?.email || undefined,
    customerAddress: invoice.customer?.billingAddress || undefined,
    items: invoice.items?.map((it: any) => ({
      description: it.description,
      sku: it.product?.sku,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discountAmount: it.discountAmount,
      taxRate: it.taxRate,
      totalAmount: it.totalAmount,
    })),
    subtotal: invoice.subtotal,
    discountAmount: invoice.discountAmount,
    taxableAmount: invoice.taxableAmount,
    cgstAmount: invoice.cgstAmount,
    sgstAmount: invoice.sgstAmount,
    additionalCharges: invoice.additionalCharges,
    totalAmount: invoice.totalAmount,
    paidAmount: invoice.paidAmount,
    outstandingAmount: invoice.outstandingAmount,
    termsAndConditions: invoice.termsAndConditions,
    notes: invoice.notes,
    createdByName: invoice.createdByUser
      ? `${invoice.createdByUser.firstName || ''} ${invoice.createdByUser.lastName || ''}`.trim()
      : undefined,
  };

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-4 sm:space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/invoices')}
            className="p-2 text-slate-400 hover:text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900 font-mono">
                {invoice.invoiceNumber}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border ${
                  statusColors[invoice.paymentStatus] || 'bg-slate-100 text-slate-600'
                }`}
              >
                {invoice.paymentStatus}
              </span>
              {invoice.quotation && (
                <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">
                  Converted from {invoice.quotation.quotationNumber}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Created on {new Date(invoice.createdAt).toLocaleDateString()} at{' '}
              {new Date(invoice.createdAt).toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPrintOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-colors shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Tax Invoice
          </button>

          {!isFullyPaid && !isCancelled && (
            <button
              onClick={() => {
                setPaymentAmount(invoice.outstandingAmount);
                setIsPaymentOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              <DollarSign className="w-4 h-4" />
              Record Payment
            </button>
          )}

          {!isCancelled && invoice.paidAmount === 0 && (
            <button
              onClick={() => setIsCancelOpen(true)}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Cancel Invoice"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Financial Status Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Invoice Total</p>
          <p className="text-xl font-black text-slate-900 font-mono mt-1">₹{invoice.totalAmount.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount Paid</p>
          <p className="text-xl font-black text-emerald-600 font-mono mt-1">₹{invoice.paidAmount.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Outstanding Balance</p>
          <p className={`text-xl font-black font-mono mt-1 ${invoice.outstandingAmount > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
            ₹{invoice.outstandingAmount.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Document Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
        {/* Customer & Branch Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
              Billed Customer
            </p>
            <p className="text-sm font-bold text-slate-900">
              {invoice.customer?.name || 'Walk-in / Cash Customer'}
            </p>
            {invoice.customer?.phone && (
              <p className="text-xs text-slate-600 mt-0.5">Phone: {invoice.customer.phone}</p>
            )}
            {invoice.customer?.email && (
              <p className="text-xs text-slate-600">Email: {invoice.customer.email}</p>
            )}
            {invoice.customer?.billingAddress && (
              <p className="text-xs text-slate-500 mt-1">{invoice.customer.billingAddress}</p>
            )}
          </div>

          <div className="text-left md:text-right space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
              Billing Metadata
            </p>
            <p className="text-xs text-slate-700">
              Branch: <span className="font-bold">{invoice.outlet?.name || 'Main Branch'}</span>
            </p>
            <p className="text-xs text-slate-700">
              Cashier:{' '}
              <span className="font-semibold">
                {invoice.createdByUser
                  ? `${invoice.createdByUser.firstName || ''} ${invoice.createdByUser.lastName || ''}`.trim() || invoice.createdByUser.email
                  : 'Counter POS'}
              </span>
            </p>
            {invoice.dueDate && (
              <p className="text-xs text-slate-700">
                Due Date: <span className="font-semibold text-amber-700">{new Date(invoice.dueDate).toLocaleDateString()}</span>
              </p>
            )}
          </div>
        </div>

        {/* Line Items Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs min-w-[620px]">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Item & Description</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-4 text-right">Discount</th>
                <th className="py-3 px-4 text-right">GST Rate</th>
                <th className="py-3 px-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.items?.map((item: any, idx: number) => (
                <tr key={item.id || idx} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-900">{item.description}</span>
                    {item.product?.sku && (
                      <span className="text-[10px] text-slate-400 ml-2 font-mono">SKU: {item.product.sku}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center font-semibold">{item.quantity}</td>
                  <td className="py-3 px-4 text-right font-mono">₹{item.unitPrice.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-500">
                    {item.discountAmount && item.discountAmount > 0 ? `₹${item.discountAmount.toFixed(2)}` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-600">
                    {item.taxRate !== undefined ? `${item.taxRate}%` : '5%'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    ₹{item.totalAmount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div className="space-y-3">
            {invoice.termsAndConditions && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                  Terms & Conditions
                </p>
                <p className="text-[11px] text-slate-600 whitespace-pre-line leading-relaxed">
                  {invoice.termsAndConditions}
                </p>
              </div>
            )}

            {invoice.notes && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                  Notes
                </p>
                <p className="text-[11px] text-slate-600 whitespace-pre-line leading-relaxed">
                  {invoice.notes}
                </p>
              </div>
            )}
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono font-semibold">₹{invoice.subtotal.toFixed(2)}</span>
            </div>

            {invoice.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Discount:</span>
                <span className="font-mono font-semibold">-₹{invoice.discountAmount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-600">
              <span>Taxable Value:</span>
              <span className="font-mono font-semibold">₹{invoice.taxableAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-slate-500 text-[11px]">
              <span>CGST:</span>
              <span className="font-mono">₹{invoice.cgstAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-slate-500 text-[11px]">
              <span>SGST:</span>
              <span className="font-mono">₹{invoice.sgstAmount.toFixed(2)}</span>
            </div>

            {invoice.additionalCharges > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Additional Charges:</span>
                <span className="font-mono font-semibold">+₹{invoice.additionalCharges.toFixed(2)}</span>
              </div>
            )}

            <div className="border-t border-slate-300 pt-2 flex justify-between items-center text-sm font-black text-slate-900">
              <span>Grand Total:</span>
              <span className="font-mono text-lg text-brand-700">₹{invoice.totalAmount.toFixed(2)}</span>
            </div>

            <div className="border-t border-slate-200 pt-2 space-y-1">
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Total Paid:</span>
                <span className="font-mono">₹{invoice.paidAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-amber-700 font-bold">
                <span>Outstanding Balance:</span>
                <span className="font-mono">₹{invoice.outstandingAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Linked Payment Receipts Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ReceiptIcon className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">Payment Receipts History</h2>
          </div>
          <span className="text-xs text-slate-400">
            {invoice.receipts?.length || 0} receipt{(invoice.receipts?.length === 1 ? '' : 's')} issued
          </span>
        </div>

        {invoice.receipts && invoice.receipts.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs min-w-[620px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Receipt #</th>
                  <th className="py-2.5 px-4">Payment Date</th>
                  <th className="py-2.5 px-4">Method</th>
                  <th className="py-2.5 px-4">Cashier</th>
                  <th className="py-2.5 px-4 text-right">Amount Paid</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.receipts.map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{r.receiptNumber}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(r.paymentDate || r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800">{r.paymentMethod}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {r.createdByUser
                        ? `${r.createdByUser.firstName || ''} ${r.createdByUser.lastName || ''}`.trim()
                        : 'Staff'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                      ₹{r.amountPaid.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${
                          r.status === 'VOIDED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => navigate(`/receipts/${r.id}`)}
                        className="text-xs font-bold text-brand-600 hover:text-brand-700"
                      >
                        View Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No payments have been recorded for this invoice yet.</p>
        )}
      </div>

      {/* Record Payment Modal */}
      {isPaymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Record Invoice Payment</h3>
                <p className="text-xs text-slate-500">
                  Outstanding Balance: <span className="font-mono font-bold text-amber-700">₹{invoice.outstandingAmount.toFixed(2)}</span>
                </p>
              </div>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount to Pay (₹) *</label>
                <input
                  type="number"
                  min="0.01"
                  max={invoice.outstandingAmount}
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e: any) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white"
                >
                  <option value="RAZORPAY">Razorpay Online Gateway (UPI / QR / Cards / NetBanking)</option>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reference / Transaction ID</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white"
                  placeholder="e.g. UPI Ref / Cheque Number"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white"
                  placeholder="Optional payment notes..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordingPayment}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold"
                >
                  {recordingPayment ? 'Recording...' : 'Generate Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Invoice Modal */}
      {isCancelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Cancel Tax Invoice</h3>
            <p className="text-xs text-slate-500">
              Cancelling will reverse inventory deductions for invoice <span className="font-mono font-bold">{invoice.invoiceNumber}</span>.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cancellation Reason *</label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                placeholder="Reason for cancellation..."
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCancelOpen(false)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCancelInvoice}
                disabled={cancelling}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Print Modal */}
      <DocumentPrintModal
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        data={printData}
      />
    </div>
  );
};
