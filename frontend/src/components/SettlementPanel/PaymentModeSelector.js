import React from "react";

export default function PaymentModeSelector({ paymentModes, selectedModes, toggleMode, totalAlloc }) {
  return (
    <div role="group" aria-label="Payment mode selection">
      <label className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[var(--text-secondary)] block mb-2">
        Payment Mode <span className="text-[var(--error)]">*</span>
      </label>
      <div className="flex flex-wrap gap-2">
        {paymentModes.map(m => (
          <button key={m} onClick={() => toggleMode(m)}
            aria-pressed={selectedModes.includes(m)}
            aria-label={`Select ${m} payment mode`}
            className={`px-2.5 py-1 text-xs font-medium rounded-sm border transition-all ${selectedModes.includes(m) ? "bg-[var(--brand)] text-white border-[var(--brand)]" : "bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--brand)] hover:text-[var(--brand)]"}`}>
            {m}
          </button>
        ))}
      </div>
      {selectedModes.length === 0 && totalAlloc > 0 && (
        <p className="text-[10px] text-[var(--error)] mt-1.5" role="alert">Select at least one payment mode</p>
      )}
    </div>
  );
}
