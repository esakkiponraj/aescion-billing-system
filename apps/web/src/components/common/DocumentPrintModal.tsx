import React from 'react';
import { Printer, X, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { Modal } from './Modal';

export interface DocumentPrintData {
  type: 'QUOTATION' | 'INVOICE' | 'RECEIPT';
  title: string;
  documentNumber: string;
  date: string;
  dueDate?: string;
  status: string;
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  businessGstin?: string;
  outletName?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerGstin?: string;
  items?: {
    id?: string;
    description: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
    discountAmount?: number;
    taxRate?: number;
    taxableAmount?: number;
    cgst?: number;
    sgst?: number;
    totalAmount: number;
  }[];
  subtotal?: number;
  discountAmount?: number;
  discountPercent?: number;
  taxableAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  additionalCharges?: number;
  totalAmount: number;
  paidAmount?: number;
  outstandingAmount?: number;
  paymentMethod?: string;
  referenceNumber?: string;
  termsAndConditions?: string;
  notes?: string;
  createdByName?: string;
}

interface DocumentPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: DocumentPrintData | null;
}

export const DocumentPrintModal: React.FC<DocumentPrintModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  if (!data) return null;

  const handlePrint = () => {
    window.print();
  };

  const isReceipt = data.type === 'RECEIPT';
  const isQuotation = data.type === 'QUOTATION';
  const isInvoice = data.type === 'INVOICE';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Print Document - ${data.documentNumber}`}
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Action Bar (Not visible when printing) */}
        <div className="no-print flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="text-xs text-slate-500">
            Preview the document below or print directly to printer/PDF.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Paper Document Container */}
        <div
          id="printable-document"
          className="bg-white text-slate-900 p-4 sm:p-8 rounded-xl border border-slate-200 shadow-sm print:p-0 print:border-none print:shadow-none font-sans text-xs overflow-x-auto"
        >
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-300 pb-4 sm:pb-6 mb-4 sm:mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 bg-slate-900 text-white flex items-center justify-center rounded font-black text-sm tracking-tight">
                  AE
                </div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                  {data.businessName}
                </h1>
              </div>
              {data.outletName && (
                <p className="text-xs font-semibold text-slate-700 mb-0.5">{data.outletName}</p>
              )}
              {data.businessAddress && (
                <p className="text-[11px] text-slate-500 max-w-sm">{data.businessAddress}</p>
              )}
              <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 mt-1">
                {data.businessPhone && <span>Phone: {data.businessPhone}</span>}
                {data.businessEmail && <span>Email: {data.businessEmail}</span>}
                {data.businessGstin && <span className="font-semibold text-slate-700">GSTIN: {data.businessGstin}</span>}
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="inline-block px-3 py-1 bg-slate-100 border border-slate-300 text-slate-800 font-extrabold uppercase tracking-wider text-xs rounded mb-2">
                {data.title}
              </span>
              <div className="text-sm font-black text-slate-900 font-mono tracking-tight">
                {data.documentNumber}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Date: <span className="font-semibold text-slate-700">{data.date}</span>
              </p>
              {data.dueDate && (
                <p className="text-[11px] text-slate-500">
                  Due Date: <span className="font-semibold text-slate-700">{data.dueDate}</span>
                </p>
              )}
              <div className="mt-2">
                <span
                  className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    data.status === 'PAID' || data.status === 'ISSUED' || data.status === 'ACCEPTED' || data.status === 'CONVERTED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : data.status === 'PARTIALLY_PAID' || data.status === 'SENT'
                      ? 'bg-blue-100 text-blue-800'
                      : data.status === 'DRAFT'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  Status: {data.status}
                </span>
              </div>
            </div>
          </div>

          {/* Billed To / Customer Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4 sm:mb-6">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                {isReceipt ? 'Received From (Customer)' : 'Bill To (Customer)'}
              </p>
              <p className="text-sm font-bold text-slate-900">{data.customerName}</p>
              {data.customerAddress && (
                <p className="text-[11px] text-slate-600 mt-0.5">{data.customerAddress}</p>
              )}
              {data.customerPhone && (
                <p className="text-[11px] text-slate-600">Phone: {data.customerPhone}</p>
              )}
              {data.customerEmail && (
                <p className="text-[11px] text-slate-600">Email: {data.customerEmail}</p>
              )}
              {data.customerGstin && (
                <p className="text-[11px] font-semibold text-slate-800 mt-1">GSTIN: {data.customerGstin}</p>
              )}
            </div>

            <div className="text-left sm:text-right">
              {isReceipt ? (
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                    Payment Details
                  </p>
                  <p className="text-xs font-bold text-slate-800">
                    Method: <span className="text-brand-700">{data.paymentMethod || 'CASH'}</span>
                  </p>
                  {data.referenceNumber && (
                    <p className="text-[11px] text-slate-600">Ref / Txn ID: {data.referenceNumber}</p>
                  )}
                  {data.createdByName && (
                    <p className="text-[11px] text-slate-500 mt-1">Issued By: {data.createdByName}</p>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                    Order Summary
                  </p>
                  <p className="text-xs text-slate-600">
                    Payment Terms: <span className="font-semibold text-slate-800">{data.paymentMethod || 'Credit / Net 30'}</span>
                  </p>
                  {data.createdByName && (
                    <p className="text-[11px] text-slate-500 mt-1">Prepared By: {data.createdByName}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Line Items Table (For Quotations & Invoices) */}
          {data.items && data.items.length > 0 && (
            <div className="mb-6 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-[11px] min-w-[550px]">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 text-right">Discount</th>
                    <th className="py-2.5 px-3 text-right">Tax Rate</th>
                    <th className="py-2.5 px-3 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-900">{item.description}</span>
                        {item.sku && <span className="text-[10px] text-slate-400 ml-2 font-mono">SKU: {item.sku}</span>}
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold">{item.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono">₹{item.unitPrice.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                        {item.discountAmount && item.discountAmount > 0 ? `₹${item.discountAmount.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        {item.taxRate !== undefined ? `${item.taxRate}%` : '5%'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        ₹{item.totalAmount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Receipt Breakdown Card (When it is a Receipt) */}
          {isReceipt && (
            <div className="mb-6 p-5 bg-emerald-50/60 border border-emerald-200 rounded-xl">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-white rounded-lg border border-emerald-100 shadow-2xs">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Previously Paid</p>
                  <p className="text-sm font-black text-slate-700 font-mono mt-1">₹{(data.paidAmount !== undefined ? (data.paidAmount - data.totalAmount) : 0).toFixed(2)}</p>
                </div>
                <div className="p-3 bg-emerald-600 text-white rounded-lg shadow-xs">
                  <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-wider">Amount Paid in this Receipt</p>
                  <p className="text-lg font-black font-mono mt-0.5">₹{data.totalAmount.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-white rounded-lg border border-emerald-100 shadow-2xs">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Remaining Balance</p>
                  <p className={`text-sm font-black font-mono mt-1 ${Number(data.outstandingAmount || 0) > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                    ₹{(data.outstandingAmount || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Totals & Calculations Section */}
          <div className="grid grid-cols-2 gap-8 pt-2 mb-6">
            <div className="space-y-3">
              {data.termsAndConditions && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                    Terms & Conditions
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-line">
                    {data.termsAndConditions}
                  </p>
                </div>
              )}

              {data.notes && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                    Notes
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-line">
                    {data.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Calculations Summary Box */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              {data.subtotal !== undefined && (
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono font-semibold">₹{data.subtotal.toFixed(2)}</span>
                </div>
              )}
              {data.discountAmount !== undefined && data.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount {data.discountPercent ? `(${data.discountPercent}%)` : ''}:</span>
                  <span className="font-mono font-semibold">-₹{data.discountAmount.toFixed(2)}</span>
                </div>
              )}
              {data.taxableAmount !== undefined && (
                <div className="flex justify-between text-slate-600">
                  <span>Taxable Amount:</span>
                  <span className="font-mono font-semibold">₹{data.taxableAmount.toFixed(2)}</span>
                </div>
              )}
              {data.cgstAmount !== undefined && data.cgstAmount > 0 && (
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>CGST:</span>
                  <span className="font-mono">₹{data.cgstAmount.toFixed(2)}</span>
                </div>
              )}
              {data.sgstAmount !== undefined && data.sgstAmount > 0 && (
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>SGST:</span>
                  <span className="font-mono">₹{data.sgstAmount.toFixed(2)}</span>
                </div>
              )}
              {data.additionalCharges !== undefined && data.additionalCharges > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Additional Charges:</span>
                  <span className="font-mono font-semibold">+₹{data.additionalCharges.toFixed(2)}</span>
                </div>
              )}

              <div className="border-t border-slate-300 pt-2 flex justify-between items-center text-sm font-black text-slate-900">
                <span>{isReceipt ? 'Total Paid Amount:' : 'Grand Total:'}</span>
                <span className="font-mono text-base text-brand-700">₹{data.totalAmount.toFixed(2)}</span>
              </div>

              {data.paidAmount !== undefined && !isReceipt && (
                <div className="border-t border-slate-200 pt-2 space-y-1 text-[11px]">
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Paid Amount:</span>
                    <span className="font-mono">₹{data.paidAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-amber-700 font-bold">
                    <span>Outstanding Balance:</span>
                    <span className="font-mono">₹{(data.outstandingAmount || 0).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Signature & Footer Section */}
          <div className="pt-8 mt-6 border-t border-slate-300 flex justify-between items-end text-[11px] text-slate-500">
            <div>
              <p className="font-semibold text-slate-700">Thank you for your business!</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Computer generated document. Valid without physical stamp.</p>
            </div>
            <div className="text-center w-48">
              <div className="border-b border-slate-400 pb-8 mb-1" />
              <p className="font-bold text-slate-800 text-[10px] uppercase tracking-wider">Authorized Signatory</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
