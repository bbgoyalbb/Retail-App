import React from "react";
import { cn } from "@/lib/utils";

const SEARCH_DATE_PRESETS = [
  { label: "Today",        from: new Date().toISOString().split("T")[0], to: new Date().toISOString().split("T")[0] },
  { label: "This Week",   from: new Date(Date.now() - ((new Date().getDay()||7)-1)*86400000).toISOString().split("T")[0], to: new Date().toISOString().split("T")[0] },
  { label: "This Month",  from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0], to: new Date().toISOString().split("T")[0] },
  { label: "Last Month",  from: new Date(new Date().getFullYear(), new Date().getMonth()-1, 1).toISOString().split("T")[0], to: new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split("T")[0] },
  { label: "Last 90 Days",from: new Date(Date.now() - 89*86400000).toISOString().split("T")[0], to: new Date().toISOString().split("T")[0] },
];

export default function DatePresets({ searchDateFrom, searchDateTo, setSearchDateFrom, setSearchDateTo }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SEARCH_DATE_PRESETS.map(p => (
        <button
          key={p.label}
          onClick={() => { setSearchDateFrom(p.from); setSearchDateTo(p.to); }}
          aria-label={`Select ${p.label} date range`}
          aria-pressed={searchDateFrom === p.from && searchDateTo === p.to}
          className={cn(
            "px-3 py-1 text-[10px] font-bold rounded-md border transition-colors uppercase tracking-wider",
            searchDateFrom === p.from && searchDateTo === p.to
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "border-border/50 text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5"
          )}
        >
          {p.label}
        </button>
      ))}
      {(searchDateFrom || searchDateTo) && (
        <button
          onClick={() => { setSearchDateFrom(""); setSearchDateTo(""); }}
          aria-label="Clear date filters"
          className="px-3 py-1 text-[10px] font-bold rounded-md border border-destructive/30 text-destructive hover:bg-destructive/5 uppercase tracking-wider"
        >
          Clear Dates
        </button>
      )}
    </div>
  );
}
