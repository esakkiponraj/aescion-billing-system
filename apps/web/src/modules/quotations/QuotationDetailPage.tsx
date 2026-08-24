import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FileText,
  ArrowLeft,
  Printer,
  Edit,
  Copy,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  CreditCard,
  Building,
  User,
  ShieldAlert,
  FileCheck,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { DocumentPrintModal, DocumentPrintData } from '../../components/common/DocumentPrintModal';
import { Modal } from '../../components/common/Modal';

export const QuotationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, organizations } = useAuthStore();
  const { activeOrgId, roles } = useTenantStore();
  const currentOrg = organizations.find((o) => o.organizationId === activeOrgId);

  const [quotation, setQuotation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Conversion Modal State
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [convertPaymentMethod, setConvertPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT'>('CASH');
  const [convertPaidAmount, setConvertPaidAmount] = useState<number>(0);
  const [convertNotes, setConvertNotes] = useState('');
  const [converting, setConverting] = useState(false);

  // Cancel Modal State
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Print Modal State
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  const fetchQuotation = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await apiRequest(`/finance/quotations/${id}`);
      setQuotation(data);
      if (data) {
        setConvertPaidAmount(data.totalAmount || 0);
      }
    } catch (err: any) {
      console.error('Failed to load quotation', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchQuotation();
  }, [fetchQuotation]);

  const handleStatusChange = async (status: string, reason?: string) => {
    try {
      await apiRequest(`/finance/quotations/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason }),
      });
      fetchQuotation();
    } catch (err: any) {
      alert(err.message || `Failed to update status to ${status}`);
    }
  };

  const handleConvert = async () => {
    try {
      setConverting(true);
      const invoice = await apiRequest(`/finance/quotations/${id}/convert`, {
        method: 'POST',
        body: JSON.stringify({
          paymentMethod: convertPaymentMethod,
          paidAmount: convertPaymentMethod === 'CREDIT' ? Number(convertPaidAmount) : quotation.totalAmount,
          notes: convertNotes || undefined,
        }),
      });
      setIsConvertOpen(false);
      navigate(`/invoices/${invoice.id}`);
    } catch (err: any) {
      alert(err.message || 'Failed to convert quotation to invoice');
    } finally {
      setConverting(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      const duplicated = await apiRequest(`/finance/quotations/${id}/duplicate`, {
        method: 'POST',
      });
      navigate(`/quotations/${duplicated.id}`);
    } catch (err: any) {
      alert(err.message || 'Failed to duplicate quotation');
    }
  };

  if (loading || !quotation) {
    return (
      <div className="p-12 text-center text-slate-400">
        <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-semibold">Loading quotation details...</p>
      </div>
    );
  }

  const isConverted = quotation.status === 'CONVERTED';
  const isDraft = quotation.status === 'DRAFT';
  const isAccepted = quotation.status === 'ACCEPTED';
  const isCancelled = quotation.status === 'CANCELLED';

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-amber-50 text-amber-700 border-amber-200',
    SENT: 'bg-blue-50 text-blue-700 border-blue-200',
    ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    CONVERTED: 'bg-purple-50 text-purple-700 border-purple-200',
    REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
    EXPIRED: 'bg-slate-100 text-slate-600 border-slate-200',
    CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
  };

  const printData: DocumentPrintData = {
    type: 'QUOTATION',
    title: 'Commercial Quotation',
    documentNumber: quotation.quotationNumber,
    date: new Date(quotation.quotationDate || quotation.createdAt).toLocaleDateString(),
    dueDate: quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : undefined,
    status: quotation.status,
    businessName: currentOrg?.organizationName || 'Business',
    businessAddress: undefined,
    outletName: quotation.outlet?.name,
    customerName: quotation.customer?.name || 'General Customer',
    customerPhone: quotation.customer?.phone || undefined,
    customerEmail: quotation.customer?.email || undefined,
    customerAddress: quotation.customer?.billingAddress || undefined,
    items: quotation.items?.map((it: any) => ({
      description: it.description || it.productName || 'Item',
      sku: it.sku,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discountAmount: it.discountAmount,
      taxRate: it.taxRate,
      totalAmount: it.totalAmount,
    })),
    subtotal: quotation.subtotal,
    discountAmount: quotation.discountAmount,
    discountPercent: quotation.discountPercent,
    taxableAmount: quotation.taxableAmount,
    cgstAmount: quotation.cgstAmount,
    sgstAmount: quotation.sgstAmount,
    additionalCharges: quotation.additionalCharges,
    totalAmount: quotation.totalAmount,
    termsAndConditions: quotation.termsAndConditions,
    notes: quotation.notes,
    createdByName: quotation.createdByUser
      ? `${quotation.createdByUser.firstName || ''} ${quotation.createdByUser.lastName || ''}`.trim()
      : undefined,
  };

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-4 sm:space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/quotations')}
            className="p-2 text-slate-400 hover:text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900 font-mono">
                {quotation.quotationNumber}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border ${
                  statusColors[quotation.status] || 'bg-slate-100 text-slate-600'
                }`}
              >
                {quotation.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Created on {new Date(quotation.createdAt).toLocaleDateString()} by{' '}
              {quotation.createdByUser
                ? `${quotation.createdByUser.firstName || ''} ${quotation.createdByUser.lastName || ''}`.trim() || quotation.createdByUser.email
                : 'Staff'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Print Button */}
          <button
            onClick={() => setIsPrintOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-colors shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / PDF
          </button>

          {/* Duplicate Button */}
          <button
            onClick={handleDuplicate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-colors shadow-2xs"
          >
            <Copy className="w-3.5 h-3.5" />
            Duplicate
          </button>

          {/* Edit (only if draft) */}
          {isDraft && (
            <button
              onClick={() => navigate(`/quotations/${id}/edit`)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-colors shadow-2xs"
            >
              <Edit className="w-3.5 h-3.5" />
              Edit
            </button>
          )}

          {/* Status Transitions */}
          {isDraft && (
            <button
              onClick={() => handleStatusChange('SENT')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors"
            >
              Mark Sent
            </button>
          )}

          {(isDraft || quotation.status === 'SENT') && (
            <button
              onClick={() => handleStatusChange('ACCEPTED')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mark Accepted
            </button>
          )}

          {!isConverted && !isCancelled && (
            <button
              onClick={() => setIsConvertOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              <FileCheck className="w-4 h-4" />
              Convert to Invoice
            </button>
          )}

          {!isConverted && !isCancelled && (
            <button
              onClick={() => setIsCancelOpen(true)}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Cancel Quotation"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Converted Invoice Notice Banner */}
      {isConverted && quotation.convertedInvoice && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-purple-900">Converted to Tax Invoice</p>
              <p className="text-[11px] text-purple-700">
                This quotation was converted into invoice{' '}
                <span className="font-mono font-bold">{quotation.convertedInvoice.invoiceNumber}</span>. Stock has been deducted.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/invoices/${quotation.convertedInvoice.id}`)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors"
          >
            View Invoice
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Document Card Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
        {/* Customer & Branch Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
              Customer Information
            </p>
            <p className="text-sm font-bold text-slate-900">
              {quotation.customer?.name || 'Walk-in / General Customer'}
            </p>
            {quotation.customer?.phone && (
              <p className="text-xs text-slate-600 mt-0.5">Phone: {quotation.customer.phone}</p>
            )}
            {quotation.customer?.email && (
              <p className="text-xs text-slate-600">Email: {quotation.customer.email}</p>
            )}
            {quotation.customer?.billingAddress && (
              <p className="text-xs text-slate-500 mt-1">{quotation.customer.billingAddress}</p>
            )}
          </div>

          <div className="text-left md:text-right space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
              Quotation Metadata
            </p>
            <p className="text-xs text-slate-700">
              Branch: <span className="font-bold">{quotation.outlet?.name || 'Main Branch'}</span>
            </p>
            <p className="text-xs text-slate-700">
              Quotation Date:{' '}
              <span className="font-semibold">
                {new Date(quotation.quotationDate || quotation.createdAt).toLocaleDateString()}
              </span>
            </p>
            {quotation.validUntil && (
              <p className="text-xs text-slate-700">
                Valid Until:{' '}
                <span className="font-semibold text-amber-700">
                  {new Date(quotation.validUntil).toLocaleDateString()}
                </span>
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
                <th className="py-3 px-4 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotation.items?.map((item: any, idx: number) => (
                <tr key={item.id || idx} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-900">
                      {item.description || item.productName || 'Item'}
                    </span>
                    {item.sku && (
                      <span className="text-[10px] text-slate-400 ml-2 font-mono">SKU: {item.sku}</span>
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

        {/* Bottom Breakdown & Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div className="space-y-3">
            {quotation.termsAndConditions && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                  Terms & Conditions
                </p>
                <p className="text-[11px] text-slate-600 whitespace-pre-line leading-relaxed">
                  {quotation.termsAndConditions}
                </p>
              </div>
            )}

            {quotation.notes && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                  Notes
                </p>
                <p className="text-[11px] text-slate-600 whitespace-pre-line leading-relaxed">
                  {quotation.notes}
                </p>
              </div>
            )}
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono font-semibold">₹{quotation.subtotal.toFixed(2)}</span>
            </div>

            {quotation.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>
                  Discount {quotation.discountPercent ? `(${quotation.discountPercent}%)` : ''}:
                </span>
                <span className="font-mono font-semibold">-₹{quotation.discountAmount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-600">
              <span>Taxable Amount:</span>
              <span className="font-mono font-semibold">₹{quotation.taxableAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-slate-500 text-[11px]">
              <span>CGST:</span>
              <span className="font-mono">₹{quotation.cgstAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-slate-500 text-[11px]">
              <span>SGST:</span>
              <span className="font-mono">₹{quotation.sgstAmount.toFixed(2)}</span>
            </div>

            {quotation.additionalCharges > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Additional Charges:</span>
                <span className="font-mono font-semibold">+₹{quotation.additionalCharges.toFixed(2)}</span>
              </div>
            )}

            <div className="border-t border-slate-300 pt-2 flex justify-between items-center text-sm font-black text-slate-900">
              <span>Grand Total:</span>
              <span className="font-mono text-lg text-brand-700">₹{quotation.totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Convert to Invoice Modal */}
      {isConvertOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <FileCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Convert to Tax Invoice</h3>
                <p className="text-xs text-slate-500">
                  Total Amount: <span className="font-mono font-bold text-slate-800">₹{quotation.totalAmount.toFixed(2)}</span>
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-[11px] text-amber-800 space-y-1">
              <p className="font-bold flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                Important Actions:
              </p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Generates a new Tax Invoice (INV-2026-XXXX).</li>
                <li>Reduces product inventory stock.</li>
                <li>Generates an official Payment Receipt for any collected payment.</li>
              </ul>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={convertPaymentMethod}
                  onChange={(e: any) => {
                    const method = e.target.value;
                    setConvertPaymentMethod(method);
                    if (method === 'CREDIT') {
                      setConvertPaidAmount(0);
                    } else {
                      setConvertPaidAmount(quotation.totalAmount);
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white"
                >
                  <option value="CASH">Cash (Full Payment)</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                  <option value="CREDIT">Credit / Partial Payment</option>
                </select>
              </div>

              {convertPaymentMethod === 'CREDIT' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Initial Paid Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    max={quotation.totalAmount}
                    step="0.01"
                    value={convertPaidAmount}
                    onChange={(e) => setConvertPaidAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-semibold focus:bg-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Remaining balance of ₹{(quotation.totalAmount - convertPaidAmount).toFixed(2)} will be added to customer receivables.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={convertNotes}
                  onChange={(e) => setConvertNotes(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white"
                  placeholder="Optional conversion notes..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsConvertOpen(false)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConvert}
                disabled={converting}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold"
              >
                {converting ? 'Converting...' : 'Confirm Conversion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {isCancelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Cancel Quotation</h3>
            <p className="text-xs text-slate-500">
              Are you sure you want to cancel quotation <span className="font-mono font-bold">{quotation.quotationNumber}</span>?
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reason for cancellation *</label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                placeholder="e.g. Customer decided not to proceed..."
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
                onClick={() => {
                  if (!cancelReason.trim()) {
                    alert('Please provide a reason');
                    return;
                  }
                  handleStatusChange('CANCELLED', cancelReason);
                  setIsCancelOpen(false);
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold"
              >
                Confirm Cancel
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
