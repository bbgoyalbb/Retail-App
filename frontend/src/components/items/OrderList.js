import React from "react";
import OrderRow from "./OrderRow";
import { Skeleton } from "@/components/ui/skeleton";
import { Package } from "@phosphor-icons/react";

/**
 * OrderList - List of grouped orders with loading/empty states
 * Props:
 *   refs: array of grouped order objects
 *   selectedRefs: Set of selected ref strings
 *   loading: boolean
 *   isSearchMode: boolean
 *   searchLoading: boolean
 *   settleTab: string
 *   onSelectRef: (ref) => void
 *   onEditGroup: (group) => void
 *   onDeleteGroup: (group) => void
 *   onInvoiceGroup: (group) => void
 *   onSettleGroup: (group) => void
 *   onToggleExpand: (ref) => void
 *   expandedRefs: object { [ref]: boolean }
 */
export default function OrderList({ 
  refs, 
  selectedRefs, 
  loading, 
  isSearchMode, 
  searchLoading, 
  settleTab,
  onSelectRef,
  onEditGroup,
  onDeleteGroup,
  onInvoiceGroup,
  onSettleGroup,
  onToggleExpand,
  expandedRefs
}) {
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({length:8}).map((_,i)=>(
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (refs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mb-6">
          <Package size={32} className="text-muted-foreground/30" aria-hidden="true" />
        </div>
        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/70 mb-2">
          {isSearchMode ? (searchLoading ? "Searching..." : "No Matches Found") : "Empty Inventory"}
        </h3>
        <p className="text-[11px] text-muted-foreground/60 font-bold max-w-[240px] leading-relaxed mb-6">
          {isSearchMode 
            ? "Try adjusting your filters or search terms to find what you're looking for." 
            : `No ${settleTab} orders are currently in the system.`}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {refs.map((group) => (
        <OrderRow
          key={group.ref}
          group={group}
          selected={selectedRefs.has(group.ref)}
          onSelect={() => onSelectRef(group.ref)}
          onEdit={() => onEditGroup(group)}
          onDelete={() => onDeleteGroup(group)}
          onInvoice={() => onInvoiceGroup(group)}
          onSettle={() => onSettleGroup(group)}
          expanded={expandedRefs[group.ref] || false}
          onToggleExpand={() => onToggleExpand(group.ref)}
        />
      ))}
    </div>
  );
}
