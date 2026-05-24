import React, { useState } from "react";
import { Plus, Trash, CheckCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function SplitForm({ item, articleTypes, onConfirm, onCancel }) {
  const [splits, setSplits] = useState([{ article_type: "N/A", qty: "" }]);
  const used = splits.reduce((s, sp) => s + (parseFloat(sp.qty) || 0), 0);
  const rem = Math.round((item.qty - used) * 100) / 100;
  const valid = Math.abs(rem) < 0.01 && splits.some(s => parseFloat(s.qty) > 0);

  const update = (i, f, v) => setSplits(p => p.map((s, j) => j === i ? { ...s, [f]: v } : s));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {splits.map((sp, i) => (
          <div key={i} className="flex gap-2 items-center">
            <select
              value={sp.article_type}
              onChange={e => update(i, "article_type", e.target.value)}
              aria-label={`Garment ${i + 1} article type`}
              className="flex-1 h-9 px-3 text-xs border border-border/50 rounded-lg bg-muted/20 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
            >
              <option value="N/A">N/A</option>
              {articleTypes.filter(t => t !== "N/A").map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="relative w-32">
              <input
                type="number"
                step="0.1"
                value={sp.qty}
                onChange={e => update(i, "qty", e.target.value)}
                placeholder="Qty (m)"
                aria-label={`Garment ${i + 1} quantity in meters`}
                className="w-full h-9 pl-3 pr-8 text-xs border border-border/50 rounded-lg bg-muted/20 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-mono"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground uppercase">m</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSplits(p => p.filter((_, j) => j !== i))}
              disabled={splits.length <= 1}
              className="h-9 w-9 text-destructive hover:bg-destructive/10 shrink-0"
              aria-label={`Remove garment ${i + 1}`}
            >
              <Trash size={16} aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSplits(p => [...p, { article_type: "N/A", qty: "" }])}
          aria-label="Add another garment"
          className="h-8 gap-2 text-[10px] font-bold uppercase tracking-widest border-primary/20 text-primary hover:bg-primary/5"
        >
          <Plus size={14} weight="bold" aria-hidden="true" /> Add Garment
        </Button>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground/60 mb-1">Remaining</p>
          <p className={cn("font-mono text-sm font-black", valid ? "text-success" : "text-destructive")} aria-live="polite">
            {rem.toFixed(2)}m
          </p>
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-4 border-t border-border/50">
        <Button variant="ghost" onClick={onCancel} className="h-10 text-[10px] font-black uppercase tracking-widest px-6">
          Cancel
        </Button>
        <Button
          onClick={() => onConfirm(splits.filter(s => parseFloat(s.qty) > 0).map(s => ({ ...s, qty: parseFloat(s.qty) })))}
          disabled={!valid}
          className="h-10 px-8 gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20"
        >
          <CheckCircle size={16} aria-hidden="true" /> Confirm Split
        </Button>
      </div>
    </div>
  );
}
