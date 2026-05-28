import React from "react";
import { PencilSimple, Trash, Printer, CaretRight, Check, Wallet, Receipt } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/fmt";

/**
 * OrderRow - Single order display in grouped list view
 * Props:
 *   group: { ref, name, date, items, totals }
 *   selected: boolean
 *   onSelect: () => void
 *   onEdit: () => void
 *   onDelete: () => void
 *   onInvoice: () => void
 *   onSettle: () => void
 *   expanded: boolean
 *   onToggleExpand: () => void
 */
export default function OrderRow({ group, selected, onSelect, onEdit, onDelete, onInvoice, onSettle, expanded, onToggleExpand }) {
  const isSettled = group.totals.pending <= 0;
  
  return (
    <div
      className={cn(
        "group relative p-4 rounded-xl border transition-all cursor-pointer",
        selected ? "bg-primary/5 border-primary/30 shadow-sm" : "bg-card border-border/50 hover:border-border/80"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-heading text-sm font-black text-foreground truncate">{group.ref}</span>
            <Badge variant={isSettled ? "success" : "warning"} className="text-[10px] font-bold uppercase tracking-wider">
              {isSettled ? "Settled" : "Pending"}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground font-medium truncate mb-2">{group.name}</p>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70 font-bold">
            <span>{group.items.length} items</span>
            <span>•</span>
            <span>₹{fmt(group.totals.total)} total</span>
            <span>•</span>
            <span className={isSettled ? "text-success" : "text-warning"}>₹{fmt(group.totals.pending)} pending</span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-primary"
            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <CaretRight size={14} className={cn("transition-transform", expanded && "rotate-90")} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-primary"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            aria-label="Edit"
          >
            <PencilSimple size={14} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-primary"
            onClick={(e) => { e.stopPropagation(); onInvoice(); }}
            aria-label="Invoice"
          >
            <Printer size={14} aria-hidden="true" />
          </Button>
          {!isSettled && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={(e) => { e.stopPropagation(); onSettle(); }}
              aria-label="Settle"
            >
              <Wallet size={14} aria-hidden="true" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label="Delete"
          >
            <Trash size={14} aria-hidden="true" />
          </Button>
        </div>
      </div>
      
      {expanded && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="space-y-1">
            {group.items.slice(0, 5).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground truncate flex-1">{item.barcode}</span>
                <span className="font-medium">₹{fmt(item.fabric_amount || 0)}</span>
              </div>
            ))}
            {group.items.length > 5 && (
              <p className="text-[10px] text-muted-foreground/60 font-medium text-center">
                +{group.items.length - 5} more items
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
