import React, { useState, useEffect, useRef } from "react";
import { X, Plus, Trash, Tag, Package, Info, Check } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/fmt";
import { getSettings } from "@/api";

// ─── Main AddOn Configurator Component ────────────────────────
export function AddOnConfigurator({ 
  items, 
  onChange, 
  onSave, 
  onClose, 
  mode = "create", // "create" (NewBill) or "edit" (Item Manager)
  customerName,
  title = "Article Add-ons",
  saveButtonText = mode === "create" ? "Confirm Add-ons" : "Update Add-ons"
}) {
  const [assignments, setAssignments] = useState([]);
  const [addonOptions, setAddonOptions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const prevItemsKey = useRef("");

  // Load settings once on mount.
  useEffect(() => {
    getSettings().then(res => {
      const s = res.data || {};
      if (Array.isArray(s.addon_items) && s.addon_items.length > 0) {
        setAddonOptions(s.addon_items);
      }
    }).catch(() => setAddonOptions(["Buttons", "Tie", "Bow"]));
  }, []);

  // Normalize items to assignments format
  useEffect(() => {
    const normalized = items.map(item => {
      // Parse addon_desc string to extract individual addons
      // Format: "Buttons(100) + Tie(50)" or "Buttons(100), Tie(50)"
      let parsedAddons = [];
      const addonDesc = item.addon_desc || "";
      if (addonDesc && addonDesc !== "N/A") {
        // Split by " + " or ", " to get individual addon entries
        const parts = addonDesc.split(/\s*\+\s*|\s*,\s*/);
        parsedAddons = parts.map(part => {
          // Match pattern like "Buttons(100)" or "Buttons"
          const match = part.match(/^(.+?)\((\d+(?:\.\d+)?)\)$/);
          if (match) {
            return { name: match[1].trim(), price: match[2] };
          }
          // If no price in parentheses, try to extract just the name
          return { name: part.trim(), price: "" };
        }).filter(a => a.name); // Filter out empty names
      }

      return {
        item_id: item.id || item._id || `temp_${Date.now()}_${Math.random()}`,
        barcode: item.barcode,
        qty: item.qty,
        // addon items array: [{ name, price }, ...]
        // Use parsed addons from addon_desc, or fallback to item.addon?.items or item.addons
        addons: parsedAddons.length > 0 ? parsedAddons : (item.addon?.items || item.addons || []).map(a => ({
          name: a.name || a.addon_name || addonOptions[0] || "Buttons",
          price: a.price || a.amount || ""
        })),
        addon_amount: item.addon_amount || item.addon?.addon_amount || 0,
        _original: item,
        _original_item_id: item.id || item._id
      };
    });

    const nextKey = normalized.map(a => a.item_id).join(",");
    if (!prevItemsKey.current || prevItemsKey.current !== nextKey) {
      setAssignments(normalized);
      prevItemsKey.current = nextKey;
    }
  }, [items, addonOptions]);

  const updateItemAddons = (index, newAddons) => {
    const newAssignments = assignments.map((a, j) => 
      j === index 
        ? { ...a, addons: newAddons, addon_amount: newAddons.reduce((s, x) => s + (parseFloat(x.price) || 0), 0) }
        : a
    );
    setAssignments(newAssignments);
    // Include _original_item_id so parent can map back to original items
    if (mode === "create" && onChange) {
      onChange(newAssignments.map(({ _original, ...rest }) => ({
        ...rest,
        _original_item_id: rest._original_item_id
      })));
    }
  };

  const addAddonToItem = (itemIndex) => {
    const item = assignments[itemIndex];
    const newAddons = [...item.addons, { name: addonOptions[0] || "Buttons", price: "" }];
    updateItemAddons(itemIndex, newAddons);
  };

  const removeAddonFromItem = (itemIndex, addonIdx) => {
    const item = assignments[itemIndex];
    const newAddons = item.addons.filter((_, i) => i !== addonIdx);
    updateItemAddons(itemIndex, newAddons);
  };

  const updateAddonField = (itemIndex, addonIdx, field, value) => {
    const item = assignments[itemIndex];
    const newAddons = item.addons.map((a, i) => i === addonIdx ? { ...a, [field]: value } : a);
    updateItemAddons(itemIndex, newAddons);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build payload - each assignment includes item_id and its current addons.
      // Send empty addon lists too so backend can clear deleted add-ons.
      const payload = assignments.map(a => ({
        item_id: a._original_item_id || a.item_id,
        addons: a.addons.map(x => ({
          name: x.name,
          price: parseFloat(x.price)
        }))
      }));
      
      await onSave(payload);
      setMsg({ type: "success", text: "Add-ons saved!" });
      setTimeout(() => onClose(), 500);
    } catch (err) {
      setMsg({ type: "error", text: err?.message || "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const totalAddonAmount = assignments.reduce((sum, a) => sum + a.addon_amount, 0);

  return (
    <div 
      className="fixed inset-0 z-[150] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <Card 
        className="w-full sm:max-w-5xl max-h-[94vh] flex flex-col shadow-2xl border-border/50 animate-in zoom-in-95 duration-150 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <CardHeader className="px-6 py-5 border-b border-border/50 bg-success/[0.03] shrink-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10 text-success">
                  <Tag size={20} weight="duotone" aria-hidden="true" />
                </div>
                <CardTitle className="text-lg font-black uppercase tracking-[0.2em]">{title}</CardTitle>
              </div>
              {customerName && (
                <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground ml-11">
                  <span className="uppercase tracking-widest">{customerName}</span>
                </div>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 rounded-full hover:bg-muted/50" aria-label="Close add-on configurator">
              <X size={20} aria-hidden="true"/>
            </Button>
          </div>
        </CardHeader>

        <div className="flex-1 overflow-y-auto p-6 bg-background">
          {msg && (
            <Badge 
              variant={msg.type === "success" ? "success" : "destructive"} 
              className="w-full py-3 justify-center mb-6 text-[10px] font-black uppercase tracking-widest"
            >
              {msg.type === "success" ? <Check className="mr-2" size={14}/> : <Info className="mr-2" size={14}/>}
              {msg.text}
            </Badge>
          )}

          {assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
              <Package size={48} weight="duotone" className="mb-4" aria-hidden="true" />
              <p className="text-[11px] font-black uppercase tracking-[0.2em]">No Items Available</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/50 shadow-sm">
              <table className="w-full text-xs min-w-[700px]">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50">Article</th>
                    <th className="text-right px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50">Qty</th>
                    <th className="text-left px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50">Add-ons</th>
                    <th className="text-right px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50 w-32">Total</th>
                    <th className="text-center px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50 w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 bg-background">
                  {assignments.map((a, i) => (
                    <tr key={a.item_id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs font-black text-primary">{a.barcode}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-mono text-xs font-bold">{a.qty}m</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-2">
                          {a.addons.map((addon, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-1 bg-background border border-border/50 rounded-xl shadow-sm">
                              <select
                                value={addon.name}
                                onChange={e => updateAddonField(i, idx, "name", e.target.value)}
                                className="h-8 pl-3 pr-1 text-xs font-bold bg-transparent outline-none cursor-pointer hover:text-success transition-colors"
                              >
                                {addonOptions.map(name => <option key={name} value={name}>{name}</option>)}
                              </select>
                              <div className="relative w-24">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground opacity-40">₹</span>
                                <input
                                  type="number"
                                  value={addon.price}
                                  onChange={e => updateAddonField(i, idx, "price", e.target.value)}
                                  className="w-full h-8 pl-6 pr-2 text-xs font-mono font-black border-none bg-muted/20 rounded-lg focus:ring-1 focus:ring-success/30 transition-all outline-none"
                                  placeholder="0"
                                />
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeAddonFromItem(i, idx)}
                                className="h-8 w-8 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                                aria-label="Remove add-on"
                              >
                                <Trash size={14} aria-hidden="true" />
                              </Button>
                            </div>
                          ))}
                          {a.addons.length === 0 && (
                            <span className="text-xs text-muted-foreground/40 font-bold uppercase tracking-widest italic py-2">No add-ons</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-mono text-xs font-black text-success tracking-tighter">
                          ₹{fmt(a.addon_amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addAddonToItem(i)}
                          className="h-8 px-3 text-[10px] font-black uppercase tracking-widest border-dashed border-success/30 text-success hover:bg-success/5 hover:border-success"
                        >
                          <Plus size={14} weight="bold" aria-hidden="true" /> Add
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Total Summary */}
          {assignments.length > 0 && (
            <div className="mt-6 flex justify-end">
              <div className="bg-success/[0.05] border border-success/20 rounded-xl px-6 py-4">
                <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground/60 mb-1">Total Add-ons</p>
                <p className="font-heading text-2xl font-black tracking-tighter text-success">₹{fmt(totalAddonAmount)}</p>
              </div>
            </div>
          )}
        </div>

        <CardContent className="px-6 py-4 border-t border-border/50 bg-muted/30 shrink-0 flex justify-end items-center gap-3">
          <Button variant="ghost" onClick={onClose} className="h-10 text-[10px] font-black uppercase tracking-widest px-6">
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving || assignments.length === 0}
            className="h-10 px-10 gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-success/20"
          >
            {saving ? (
              <>Processing <span className="animate-spin">⟳</span></>
            ) : (
              <><Check size={16} weight="bold"/> {saveButtonText}</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default AddOnConfigurator;
