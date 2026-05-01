import { useMemo } from "react";
import { MagnifyingGlass, X, Funnel, CaretDown, CaretRight } from "@phosphor-icons/react";
import { DatePickerInput } from "@/components/DatePickerInput";

const SEARCH_DATE_PRESETS = [
  { label: "Today",        from: new Date().toISOString().split("T")[0], to: new Date().toISOString().split("T")[0] },
  { label: "This Week",   from: new Date(Date.now() - ((new Date().getDay()||7)-1)*86400000).toISOString().split("T")[0], to: new Date().toISOString().split("T")[0] },
  { label: "This Month",  from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0], to: new Date().toISOString().split("T")[0] },
  { label: "Last Month",  from: new Date(new Date().getFullYear(), new Date().getMonth()-1, 1).toISOString().split("T")[0], to: new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split("T")[0] },
  { label: "Last 90 Days",from: new Date(Date.now() - 89*86400000).toISOString().split("T")[0], to: new Date().toISOString().split("T")[0] },
];

const SETTLE_TABS = [
  { k: "unsettled", l: "Pending" },
  { k: "awaiting",  l: "Awaiting" },
  { k: "settled",   l: "Settled" },
  { k: "all",       l: "All" },
];

/**
 * ItemsFilterBar - Search, filter tabs, and advanced filters for ItemsManager
 * 
 * @param {Object} props
 * @param {string} props.nameFilter - Current search text
 * @param {Function} props.setNameFilter - Search text setter
 * @param {string} props.settleTab - Active tab key
 * @param {Function} props.setSettleTab - Tab setter
 * @param {Function} props.setSelectedRefs - Clear selection callback
 * @param {string} props.sortDir - "asc" or "desc"
 * @param {Function} props.setSortDir - Sort direction setter
 * @param {boolean} props.showFilters - Show advanced filters
 * @param {Function} props.setShowFilters - Toggle filters
 * @param {boolean} props.hasAdvancedFilters - Whether any advanced filter is active
 * @param {boolean} props.isSearchMode - Whether search results are showing
 * @param {Function} props.clearSearch - Clear search callback
 * @param {Object} props.message - {type, text} or null
 * @param {Object} props.searchRef - Ref for search input
 * 
 * Advanced filter props:
 * @param {string} props.searchDateFrom - Date from
 * @param {Function} props.setSearchDateFrom 
 * @param {string} props.searchDateTo - Date to
 * @param {Function} props.setSearchDateTo
 * @param {string} props.searchCustomer - Selected customer
 * @param {Function} props.setSearchCustomer
 * @param {string} props.searchStatus - Tailoring status filter
 * @param {Function} props.setSearchStatus
 * @param {string} props.searchPayment - Payment status filter
 * @param {Function} props.setSearchPayment
 * @param {string} props.searchMinAmt - Min amount
 * @param {Function} props.setSearchMinAmt
 * @param {string} props.searchMaxAmt - Max amount
 * @param {Function} props.setSearchMaxAmt
 * @param {string[]} props.customers - Customer list for dropdown
 */
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
  const datePresets = useMemo(() => SEARCH_DATE_PRESETS, []);

  return (
    <div className="flex-shrink-0 bg-[var(--surface)] border-b border-[var(--border-subtle)]">
      {/* Row 1: sort left + tabs right */}
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2">
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
            className="flex items-center gap-1.5 px-2 py-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)] transition-colors text-xs"
            title="Toggle sort order"
          >
            {sortDir === "desc" ? <CaretDown size={13} /> : <CaretRight size={13} className="-rotate-90" />}
            <span className="hidden sm:inline">Order Date: {sortDir === "desc" ? "Newest" : "Oldest"}</span>
          </button>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-0.5 bg-[var(--bg)] border border-[var(--border-subtle)] rounded-sm p-0.5 overflow-x-auto no-scrollbar flex-shrink-0">
          {SETTLE_TABS.map(t => (
            <button
              key={t.k}
              onClick={() => { setSettleTab(t.k); setSelectedRefs(new Set()); }}
              className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-all whitespace-nowrap flex-shrink-0 ${
                settleTab === t.k ? "bg-[var(--brand)] text-white shadow-sm" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]"
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {/* Row 2: search bar + filter toggle */}
      <div className="flex items-center gap-2 px-3 sm:px-4 pb-2">
        <div className="relative flex-1 min-w-0">
          <MagnifyingGlass size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            value={nameFilter}
            onChange={e => setNameFilter(e.target.value)}
            placeholder="Search by name, barcode, ref, article type, karigar…"
            className="w-full pl-7 pr-6 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] bg-[var(--surface)]"
          />
          {nameFilter && (
            <button onClick={() => setNameFilter("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <X size={11} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(f => !f)}
          className={`flex items-center gap-1.5 px-2 py-1.5 text-xs border rounded-sm transition-colors flex-shrink-0 ${
            (showFilters || hasAdvancedFilters) ? "bg-[var(--brand)] text-white border-[var(--brand)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
          }`}
        >
          <Funnel size={13} /><span className="hidden sm:inline">Filters{hasAdvancedFilters ? " ·" : ""}</span>
        </button>
        {isSearchMode && (
          <button
            onClick={clearSearch}
            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--error)] border border-[var(--border-subtle)] rounded-sm flex-shrink-0"
            title="Clear search"
          >
            <X size={13} />
          </button>
        )}
        {message && (
          <div className={`text-xs px-2.5 py-1.5 rounded-sm border flex-shrink-0 ${
            message.type === "success" ? "bg-[#455D4A10] border-[var(--success)] text-[var(--success)]" : "bg-[#9E473D10] border-[var(--error)] text-[var(--error)]"
          }`}>
            {message.text}
          </div>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="px-3 sm:px-4 pb-3 border-t border-[var(--border-subtle)] pt-2.5 space-y-2.5">
          <div className="flex flex-wrap gap-1">
            {datePresets.map(p => (
              <button
                key={p.label}
                onClick={() => { setSearchDateFrom(p.from); setSearchDateTo(p.to); }}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-sm border transition-colors ${
                  searchDateFrom === p.from && searchDateTo === p.to
                    ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                    : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
                }`}
              >
                {p.label}
              </button>
            ))}
            {(searchDateFrom || searchDateTo) && (
              <button
                onClick={() => { setSearchDateFrom(""); setSearchDateTo(""); }}
                className="px-2.5 py-1 text-[10px] rounded-sm border border-[var(--border-subtle)] text-[var(--error)] hover:bg-[#9E473D08]"
              >
                Clear dates
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            <div>
              <label className="text-[9px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1">Customer</label>
              <select
                value={searchCustomer}
                onChange={e => setSearchCustomer(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm bg-[var(--surface)]"
              >
                <option value="All">All</option>
                {customers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1">Date From</label>
              <DatePickerInput value={searchDateFrom} onChange={setSearchDateFrom} placeholder="From date" />
            </div>
            <div>
              <label className="text-[9px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1">Date To</label>
              <DatePickerInput value={searchDateTo} onChange={setSearchDateTo} placeholder="To date" />
            </div>
            <div>
              <label className="text-[9px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1">Tailoring Status</label>
              <select
                value={searchStatus}
                onChange={e => setSearchStatus(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm bg-[var(--surface)]"
              >
                {["All", "N/A", "Awaiting Order", "Pending", "Stitched", "Delivered"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1">Payment</label>
              <select
                value={searchPayment}
                onChange={e => setSearchPayment(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm bg-[var(--surface)]"
              >
                {["All", "Pending", "Settled"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1">Min Amount</label>
              <input
                type="number"
                value={searchMinAmt}
                onChange={e => setSearchMinAmt(e.target.value)}
                placeholder="0"
                className="w-full px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm bg-[var(--surface)]"
              />
            </div>
            <div>
              <label className="text-[9px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1">Max Amount</label>
              <input
                type="number"
                value={searchMaxAmt}
                onChange={e => setSearchMaxAmt(e.target.value)}
                placeholder="∞"
                className="w-full px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm bg-[var(--surface)]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
