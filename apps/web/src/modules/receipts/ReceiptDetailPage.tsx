import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Shield,
  ArrowLeft,
  Printer,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Building,
  User,
  CreditCard,
  ArrowRight,
  FileCheck,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { DocumentPrintModal, DocumentPrintData } from '../../components/common/DocumentPrintModal';

export const ReceiptDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, organizations } = useAuthStore();
  const { activeOrgId, roles } = useTenantStore();
  const currentOrg = organizations.find((o) => o.organizationId === activeOrgId);

  const isOwner = roles.includes('OWNER') || user?.isSuperAdmin;

  const [receipt, setReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Void Modal State
  const [isVoidOpen, setIsVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  // Print Modal State
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  const fetchReceipt = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await apiRequest(`/finance/receipts/${id}`);
      setReceipt(data);
    } catch (err: any) {
      console.error('Failed to load receipt', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReceipt();
  }, [fetchReceipt]);

  const handleVoidReceipt = async () => {
    if (!voidReason.trim()) {
      alert('Please provide a reason to void this receipt.');
      return;
    }

    try {
      setVoiding(true);
      await apiRequest(`/finance/receipts/${id}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason: voidReason }),
      });
      setIsVoidOpen(false);
      fetchReceipt();
    } catch (err: any) {
      alert(err.message || 'Failed to void receipt');
    } finally {
      setVoiding(false);
    }
  };

  if (loading || !receipt) {
    return (
      <div className="p-12 text-center text-slate-400">
        <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-semibold">Loading receipt details...</p>
      </div>
    );
  }

  const isVoided = receipt.status === 'VOIDED';

  const printData: DocumentPrintData = {
    type: 'RECEIPT',
    title: 'Payment Receipt',
    documentNumber: receipt.receiptNumber,
    date: new Date(receipt.paymentDate || receipt.createdAt).toLocaleDateString(),
    status: receipt.status,
    businessName: currentOrg?.organizationName || 'Business',
    businessAddress: undefined,
    outletName: receipt.outlet?.name,
    customerName: receipt.customer?.name || 'Walk-in Customer',
    customerPhone: receipt.customer?.phone || undefined,
    customerEmail: receipt.customer?.email || undefined,
    customerAddress: receipt.customer?.billingAddress || undefined,
    totalAmount: receipt.amountPaid,
    paidAmount: receipt.totalPaid,
    outstandingAmount: receipt.remainingBalance,
    paymentMethod: receipt.paymentMethod,
    referenceNumber: receipt.referenceNumber || undefined,
    notes: receipt.notes || (receipt.invoice ? `Payment for Invoice ${receipt.invoice.invoiceNumber}` : undefined),
    createdByName: receipt.createdByUser
      ? `${receipt.createdByUser.firstName || ''} ${receipt.createdByUser.lastName || ''}`.trim()
      : undefined,
  };

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-4 sm:space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/receipts')}
            className="p-2 text-slate-400 hover:text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900 font-mono">
                {receipt.receiptNumber}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                  isVoided
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                {receipt.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Issued on {new Date(receipt.paymentDate || receipt.createdAt).toLocaleDateString()} at{' '}
              {new Date(receipt.createdAt).toLocaleTimeString()}
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
            Print Receipt
          </button>

          {isOwner && !isVoided && (
            <button
              onClick={() => setIsVoidOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Void Receipt
            </button>
          )}
        </div>
      </div>

      {/* Void Notice Card (if Voided) */}
      {isVoided && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            This receipt has been VOIDED
          </div>
          <p className="text-xs text-rose-700">
            <span className="font-semibold">Reason:</span> {receipt.voidReason || 'No reason provided'}
          </p>
          <p className="text-[11px] text-rose-600">
            Voided by {receipt.voidedByUser ? `${receipt.voidedByUser.firstName || ''} ${receipt.voidedByUser.lastName || ''}`.trim() : 'Owner'} on{' '}
            {receipt.voidedAt ? new Date(receipt.voidedAt).toLocaleString() : 'N/A'}. The invoice balance has been reversed.
          </p>
        </div>
      )}

      {/* Financial Highlight Card */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-6 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="p-4 bg-white rounded-xl border border-emerald-100 shadow-2xs">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Previously Paid</p>
            <p className="text-base font-black text-slate-700 font-mono mt-1">
              ₹{(receipt.previouslyPaid || 0).toFixed(2)}
            </p>
          </div>
          <div className="p-4 bg-emerald-600 text-white rounded-xl shadow-xs">
            <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-wider">Amount Collected</p>
            <p className="text-2xl font-black font-mono mt-0.5">₹{receipt.amountPaid.toFixed(2)}</p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-emerald-100 shadow-2xs">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Remaining Balance</p>
            <p className={`text-base font-black font-mono mt-1 ${receipt.remainingBalance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              ₹{(receipt.remainingBalance || 0).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Details Box */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Customer & Method Details */}
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                Customer Details
              </p>
              <p className="text-sm font-bold text-slate-900">
                {receipt.customer?.name || 'Walk-in / General Customer'}
              </p>
              {receipt.customer?.phone && (
                <p className="text-xs text-slate-600 mt-0.5">Phone: {receipt.customer.phone}</p>
              )}
              {receipt.customer?.email && (
                <p className="text-xs text-slate-600">Email: {receipt.customer.email}</p>
              )}
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                Payment Info
              </p>
              <div className="flex justify-between">
                <span className="text-slate-600">Payment Method:</span>
                <span className="font-bold text-slate-900">{receipt.paymentMethod}</span>
              </div>
              {receipt.referenceNumber && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Reference / Txn ID:</span>
                  <span className="font-mono text-slate-800">{receipt.referenceNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600">Issued by Cashier:</span>
                <span className="font-semibold text-slate-800">
                  {receipt.createdByUser
                    ? `${receipt.createdByUser.firstName || ''} ${receipt.createdByUser.lastName || ''}`.trim() || receipt.createdByUser.email
                    : 'Staff'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Branch:</span>
                <span className="font-semibold text-slate-800">{receipt.outlet?.name || 'Main Branch'}</span>
              </div>
            </div>
          </div>

          {/* Linked Invoice Card */}
          {receipt.invoice && (
            <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Linked Sales Invoice
                </p>
                <button
                  onClick={() => navigate(`/invoices/${receipt.invoice.id}`)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700"
                >
                  View Invoice
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2 text-xs pt-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Invoice Number:</span>
                  <span className="font-mono font-bold text-slate-900">{receipt.invoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Invoice Amount:</span>
                  <span className="font-mono font-semibold">₹{receipt.invoice.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Paid:</span>
                  <span className="font-mono text-emerald-600 font-semibold">₹{receipt.invoice.paidAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Outstanding Balance:</span>
                  <span className="font-mono text-amber-700 font-bold">₹{receipt.invoice.outstandingAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="text-slate-600">Invoice Status:</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-slate-200 text-slate-800">
                    {receipt.invoice.paymentStatus}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        {receipt.notes && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Receipt Notes</p>
            <p className="text-slate-700 whitespace-pre-line">{receipt.notes}</p>
          </div>
        )}
      </div>

      {/* Owner Void Receipt Modal */}
      {isVoidOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Void Payment Receipt</h3>
                <p className="text-xs text-slate-500 font-mono">{receipt.receiptNumber}</p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-[11px] text-rose-800 space-y-1">
              <p className="font-bold">Financial Reversal Warning:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Deducts ₹{receipt.amountPaid.toFixed(2)} from invoice paid amount.</li>
                <li>Increases invoice & customer outstanding balance by ₹{receipt.amountPaid.toFixed(2)}.</li>
                <li>Receipt remains in the database marked as VOIDED for audit history.</li>
              </ul>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Voiding *</label>
              <textarea
                rows={2}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                placeholder="e.g. Transaction bounced, incorrect payment entry..."
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsVoidOpen(false)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleVoidReceipt}
                disabled={voiding}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold"
              >
                {voiding ? 'Voiding...' : 'Confirm Void'}
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
