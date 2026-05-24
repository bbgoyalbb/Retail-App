import React from "react";
import { ArrowsSplit } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/DatePickerInput";
import { cn } from "@/lib/utils";

const EMB_OPTIONS = ["Not Required", "Required"];

export default function TailoringTable({ assignments, articleTypes, update, onSplitClick }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/50 shadow-sm">
      <table className="w-full text-xs min-w-[850px]">
        <thead className="bg-muted/30">
          <tr>
            <th className="px-4 py-3.5 w-10 border-b border-border/50"><span className="sr-only">Select</span></th>
            <th className="text-left px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50">Article</th>
            <th className="text-right px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50">Qty (m)</th>
            <th className="text-left px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50 w-24">Order No</th>
            <th className="text-left px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50 w-44">Delivery Date</th>
            <th className="text-left px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50 w-32">Article Type</th>
            <th className="text-left px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50 w-36">Embroidery</th>
            <th className="text-center px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50 w-16">Split</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50 bg-background">
          {assignments.map((a, i) => (
            <tr key={a.item_id} className={cn("hover:bg-muted/10 transition-colors", !a.selected && "opacity-40")}>
              <td className="px-4 py-3.5">
                <input
                  type="checkbox"
                  checked={a.selected}
                  onChange={e => update(i, "selected", e.target.checked)}
                  aria-label={`Select article ${a.barcode}`}
                  className="w-4 h-4 rounded border-border/50 text-primary focus:ring-primary/20 accent-primary transition-all"
                />
              </td>
              <td className="px-4 py-3.5">
                <span className="font-mono text-xs font-black text-primary">{a.barcode}</span>
              </td>
              <td className="px-4 py-3.5 text-right">
                <span className="font-mono text-xs font-bold">{a.qty}m</span>
              </td>
              <td className="px-4 py-3.5">
                <input
                  type="text"
                  value={a.order_no}
                  onChange={e => update(i, "order_no", e.target.value)}
                  placeholder="e.g. 801"
                  aria-label={`Order number for ${a.barcode}`}
                  className="w-full h-8 px-2 text-[11px] font-mono border border-border/50 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary bg-muted/20 transition-all outline-none"
                />
              </td>
              <td className="px-4 py-3.5">
                <DatePickerInput
                  value={a.delivery_date}
                  onChange={(val) => update(i, "delivery_date", val)}
                  placeholder="Select date"
                  aria-label={`Delivery date for ${a.barcode}`}
                />
              </td>
              <td className="px-4 py-3.5">
                <select
                  value={a.article_type}
                  onChange={e => update(i, "article_type", e.target.value)}
                  aria-label={`Article type for ${a.barcode}`}
                  className="w-full h-8 px-2 text-[11px] font-bold border border-border/50 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary bg-muted/20 transition-all outline-none"
                >
                  <option value="N/A">N/A</option>
                  {articleTypes.filter(t => t !== "N/A").map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </td>
              <td className="px-4 py-3.5">
                <select
                  value={a.embroidery_status}
                  onChange={e => update(i, "embroidery_status", e.target.value)}
                  aria-label={`Embroidery status for ${a.barcode}`}
                  className="w-full h-8 px-2 text-[11px] font-bold border border-border/50 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary bg-muted/20 transition-all outline-none"
                >
                  {EMB_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </td>
              <td className="px-4 py-3.5 text-center">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onSplitClick(a)}
                  className="h-8 w-8 text-primary hover:bg-primary/10"
                  aria-label={`Split article ${a.barcode}`}
                >
                  <ArrowsSplit size={14} weight="bold" aria-hidden="true" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
