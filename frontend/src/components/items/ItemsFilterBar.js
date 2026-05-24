import { useMemo } from "react";
import { MagnifyingGlass, X, Funnel, CaretDown, CaretRight, ArrowsClockwise } from "@phosphor-icons/react";
import { DatePickerInput } from "@/components/DatePickerInput";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import FilterField from "./FilterField";
import DatePresets from "./DatePresets";

const SETTLE_TABS = [
  { k: "unsettled", l: "Pending" },
  { k: "awaiting",  l: "Awaiting" },
  { k: "settled",   l: "Settled" },
  { k: "all",       l: "All" },
];

export default function ItemsFilterBar({
  nameFilter, setNameFilter,
  settleTab, setSettleTab, setSelectedRefs,
  sortDir, setSortDir,
  showFilters, setShowFilters, hasAdvancedFilters,
  isSearchMode, clearSearch,
  message,
  searchRef,
  searchDateFrom, setSearchDateFrom,
  searchDateTo, setSearchDateTo,
  searchCustomer, setSearchCustomer,
  searchStatus, setSearchStatus,
  searchPayment, setSearchPayment,
  searchMinAmt, setSearchMinAmt,
  searchMaxAmt, setSearchMaxAmt,
  customers,
}) {

  return (
    <div className="flex-shrink-0 bg-background border-b border-border/50 sticky top-0 z-20">
      {/* Row 1: sort left + tabs right */}
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
            className="h-8 text-[11px] font-medium tracking-tight"
          >
            {sortDir === "desc" ? <CaretDown className="w-3.5 h-3.5" aria-hidden="true" /> : <CaretRight className="w-3.5 h-3.5 -rotate-90" aria-hidden="true" />}
            <span className="hidden sm:inline">Order Date: {sortDir === "desc" ? "Newest" : "Oldest"}</span>
          </Button>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1 bg-muted/30 border border-border/50 rounded-full p-1 overflow-x-auto no-scrollbar flex-shrink-0">
          {SETTLE_TABS.map(t => (
            <button
              key={t.k}
              onClick={() => { setSettleTab(t.k); setSelectedRefs(new Set()); }}
              className={cn(
                "px-4 py-1 text-[11px] font-semibold rounded-full transition-colors whitespace-nowrap flex-shrink-0",
                settleTab === t.k 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {/* Row 2: search bar + filter toggle */}
      <div className="flex items-center gap-3 px-4 pb-3">
        <div className="relative flex-1 min-w-0 group">
          <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none" aria-hidden="true" />
          <input
            ref={searchRef}
            type="text"
            value={nameFilter}
            onChange={e => setNameFilter(e.target.value)}
            placeholder="Search name, barcode, ref, article, karigar..."
            className="w-full pl-9 pr-8 h-9 text-xs border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-muted/20 transition-colors"
          />
          {nameFilter && (
            <button
              onClick={() => setNameFilter("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-colors"
              aria-label="Clear search"
            >
              <X size={12} aria-hidden="true" />
            </button>
          )}
        </div>
        
        <Button
          variant={showFilters || hasAdvancedFilters ? "default" : "outline"}
          size="sm"
          onClick={() => setShowFilters(f => !f)}
          className={cn(
            "h-9 px-3 gap-2 text-xs",
            hasAdvancedFilters && !showFilters && "border-primary text-primary"
          )}
        >
          <Funnel className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Filters</span>
          {hasAdvancedFilters && (
            <span className="w-1.5 h-1.5 rounded-full bg-current ml-0.5 animate-pulse" />
          )}
        </Button>

        {isSearchMode && (
          <Button
            variant="ghost"
            size="icon"
            onClick={clearSearch}
            className="h-9 w-9 text-destructive hover:bg-destructive/10"
            aria-label="Clear all filters"
          >
            <X size={16} aria-hidden="true" />
          </Button>
        )}

        {message && (
          <Badge 
            variant={message.type === "success" ? "success" : "destructive"}
            className="h-9 px-3"
          >
            {message.text}
          </Badge>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-4">
          <DatePresets searchDateFrom={searchDateFrom} searchDateTo={searchDateTo} setSearchDateFrom={setSearchDateFrom} setSearchDateTo={setSearchDateTo} />

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <FilterField label="Customer">
              <select
                value={searchCustomer}
                onChange={e => setSearchCustomer(e.target.value)}
                className="w-full h-8 px-2 text-xs border border-border/50 rounded-md bg-muted/20 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors outline-none"
              >
                <option value="All">All Customers</option>
                {customers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FilterField>

            <FilterField label="Date From">
              <DatePickerInput value={searchDateFrom} onChange={setSearchDateFrom} placeholder="Select date" />
            </FilterField>

            <FilterField label="Date To">
              <DatePickerInput value={searchDateTo} onChange={setSearchDateTo} placeholder="Select date" />
            </FilterField>

            <FilterField label="Tailoring Status">
              <select
                value={searchStatus}
                onChange={e => setSearchStatus(e.target.value)}
                className="w-full h-8 px-2 text-xs border border-border/50 rounded-md bg-muted/20 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors outline-none"
              >
                {["All", "N/A", "Awaiting Order", "Pending", "Stitched", "Delivered"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FilterField>

            <FilterField label="Payment">
              <select
                value={searchPayment}
                onChange={e => setSearchPayment(e.target.value)}
                className="w-full h-8 px-2 text-xs border border-border/50 rounded-md bg-muted/20 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors outline-none"
              >
                {["All", "Pending", "Settled"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FilterField>

            <FilterField label="Min Amount">
              <input
                type="number"
                value={searchMinAmt}
                onChange={e => setSearchMinAmt(e.target.value)}
                placeholder="0"
                className="w-full h-8 px-2 text-xs border border-border/50 rounded-md bg-muted/20 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors outline-none"
              />
            </FilterField>

            <FilterField label="Max Amount">
              <input
                type="number"
                value={searchMaxAmt}
                onChange={e => setSearchMaxAmt(e.target.value)}
                placeholder="∞"
                className="w-full h-8 px-2 text-xs border border-border/50 rounded-md bg-muted/20 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors outline-none"
              />
            </FilterField>
          </div>
        </div>
      )}
    </div>
  );
}
