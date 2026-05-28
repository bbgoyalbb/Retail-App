import { useState, useEffect } from "react";
import { X, ArrowSquareOut, Printer } from "@phosphor-icons/react";
import { getInvoiceUrl } from "@/api";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import InvoiceFormatDialog from "./InvoiceFormatDialog";

export default function InvoiceModal({ billRef, format = "standard", billRefs = null, onClose }) {
  const [showFormatDialog, setShowFormatDialog] = useState(false);
  const [url, setUrl] = useState(null);
  const trapRef = useFocusTrap(true);

  useEffect(() => {
    getInvoiceUrl(billRef, format, billRefs).then(setUrl);
  }, [billRef, format, billRefs]);

  const handleFormatSelect = async (selectedFormat) => {
    setShowFormatDialog(false);
    const invoiceUrl = await getInvoiceUrl(billRef, selectedFormat, billRefs);
    window.open(invoiceUrl, '_blank');
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center sm:p-4">
      <div ref={trapRef} className="bg-[var(--surface)] rounded-none sm:rounded-sm w-full sm:max-w-3xl h-full sm:h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] flex-shrink-0">
          <p className="font-heading text-sm font-semibold text-[var(--text-primary)]">Invoice Preview — {billRef}</p>
          <div className="flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open invoice in new tab"
              className="p-1.5 rounded-sm hover:bg-[var(--bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ArrowSquareOut size={16} aria-hidden="true" />
            </a>
            <button
              onClick={() => setShowFormatDialog(true)}
              aria-label={isMobile ? "Share or print invoice" : "Print invoice"}
              className="p-1.5 rounded-sm hover:bg-[var(--bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Printer size={16} aria-hidden="true" />
            </button>
            <button
              onClick={onClose}
              aria-label="Close invoice preview"
              className="p-1.5 rounded-sm hover:bg-[var(--bg)] text-[var(--text-secondary)] hover:text-red-500 transition-colors"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        {/* iframe */}
        <iframe
          id="invoice-iframe"
          src={url}
          title="Invoice"
          className="flex-1 w-full border-0 rounded-b-sm"
        />
      </div>
      {showFormatDialog && (
        <InvoiceFormatDialog
          open={showFormatDialog}
          onClose={() => setShowFormatDialog(false)}
          onSelect={handleFormatSelect}
        />
      )}
    </div>
  );
}
