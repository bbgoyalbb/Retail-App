import { CheckCircle, Printer, Plus } from "@phosphor-icons/react";

/**
 * BillSuccessPanel - Post-save success view with actions
 * 
 * @param {Object} props
 * @param {string} props.billRef - The saved bill reference number
 * @param {number} props.total - The saved bill total
 * @param {Function} props.onViewInvoice - Callback to view invoice modal
 * @param {Function} props.onPrint - Callback to open print view
 * @param {Function} props.onCreateAnother - Callback to create another bill
 */
export default function BillSuccessPanel({
  billRef,
  total,
  onViewInvoice,
  onPrint,
  onCreateAnother
}) {
  return (
    <div className="bg-[var(--surface)] border-2 border-[var(--success)] rounded-sm p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[var(--success)]">
            Bill Saved Successfully
          </p>
          <p className="font-heading text-2xl font-semibold tracking-tight mt-1" style={{ color: "var(--brand)" }}>
            Ref: {billRef}
          </p>
          <p className="font-mono text-lg text-[var(--text-primary)] mt-1">
            ₹{total.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle size={32} weight="fill" className="text-[var(--success)]" aria-hidden="true" />
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-2">
        <button
          onClick={onViewInvoice}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-[var(--success)] text-white rounded-sm hover:bg-[#3d4d3f]"
          type="button"
          aria-label="View invoice"
        >
          <Printer size={16} aria-hidden="true" /> View Invoice
        </button>
        <button
          onClick={onPrint}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border border-[var(--border-subtle)] rounded-sm hover:border-[var(--brand)]"
          type="button"
          aria-label="Print invoice"
        >
          <Printer size={16} weight="bold" aria-hidden="true" /> Print
        </button>
        <button
          onClick={onCreateAnother}
          className="w-full sm:w-auto sm:ml-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)]"
          type="button"
          aria-label="Create another bill"
        >
          <Plus size={16} weight="bold" aria-hidden="true" /> Create Another Bill
        </button>
      </div>
    </div>
  );
}
