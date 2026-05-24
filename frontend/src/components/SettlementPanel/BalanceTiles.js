import React from "react";
import { fmt } from "@/lib/fmt";

export default function BalanceTiles({ aggBalances, totalPending, isMulti }) {
  return (
    <div role="region" aria-label="Pending balance breakdown">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[var(--text-secondary)]">
          {isMulti ? "Combined Pending" : "Pending Balances"}
        </p>
        <span className="font-mono text-sm font-semibold text-[var(--warning)]" aria-live="polite">₹{fmt(totalPending)}</span>
      </div>
      {/* 2 columns on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Fabric",    value: aggBalances.fabric,     color: "var(--warning)" },
          { label: "Tailoring", value: aggBalances.tailoring,  color: "var(--info)" },
          { label: "Emb.",      value: aggBalances.embroidery, color: "var(--brand)" },
          { label: "Add-on",    value: aggBalances.addon,      color: "var(--text-secondary)" },
        ].map(b => b.value > 0 ? (
          <div key={b.label} className="p-2 rounded-sm text-center bg-[var(--bg)] border border-[var(--border-subtle)]">
            <p className="text-[9px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">{b.label}</p>
            <p className="font-mono text-xs font-semibold mt-0.5" style={{ color: b.color }}>₹{fmt(b.value)}</p>
          </div>
        ) : null)}
      </div>
      {aggBalances.advance > 0 && (
        <div className="mt-2 p-2.5 bg-[#455D4A08] border border-[#455D4A30] rounded-sm flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">Advance credit available</span>
          <span className="font-mono text-sm font-semibold text-[var(--success)]">₹{fmt(aggBalances.advance)}</span>
        </div>
      )}
    </div>
  );
}
