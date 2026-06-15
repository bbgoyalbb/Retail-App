import React, { useState, useEffect, useMemo, useRef } from "react";
import { X, Check, Plus, Scissors, ArrowsSplit, Package, Info, CheckCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getSettings } from "@/api";
import TailoringTable from "./TailoringConfigurator/TailoringTable";
import SplitForm from "./TailoringConfigurator/SplitForm";

// ─── Main Tailoring Configurator Component ──────────────────────
export function TailoringConfigurator({ 
  items, 
  onChange, 
  onSave, 
  onClose, 
  onSplit, // Callback for edit mode to split item in database
  mode = "create", // "create" (NewBill) or "edit" (Item Manager)
  customerName,
  title = "Tailoring Configuration",
  saveButtonText = mode === "create" ? "Save Configuration" : "Confirm Assignment",
  settingsLoader = getSettings
}) {
  const [assignments, setAssignments] = useState([]);
  const [splitItem, setSplitItem] = useState(null);
  const [articleTypes, setArticleTypes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const prevItemsKey = useRef("");

  // Load settings once on mount.
  useEffect(() => {
    settingsLoader().then(res => {
      const s = res.data || {};
      if (Array.isArray(s.article_types) && s.article_types.length > 0) setArticleTypes(s.article_types);
    }).catch(() => setArticleTypes(["Shirt", "Pant", "Kurta"]));
  }, [settingsLoader]);

  // Normalize incoming items to assignments format.
  useEffect(() => {
    const normalized = items.map(item => ({
      item_id: item.id || item._id || `temp_${Date.now()}_${Math.random()}`,
      barcode: item.barcode,
      qty: item.qty,
      article_type: item.tailoring?.article_type || "N/A",
      embroidery_status: item.tailoring?.embroidery_status || item.embroidery_status || "Not Required",
      order_no: item.tailoring?.order_no || "",
      delivery_date: item.tailoring?.delivery_date || "",
      selected: mode === "create" ? Boolean(item.tailoring?.enabled) : true,
      // Keep reference to original item for callbacks
      _original: item,
      _original_item_id: item.id || item._id
    }));
    const nextKey = normalized.map(a => a.item_id).join(",");
    if (!prevItemsKey.current || prevItemsKey.current !== nextKey) {
      setAssignments(normalized);
      prevItemsKey.current = nextKey;
    }
  }, [items]);

  // Copy order_no and delivery_date from first selected item to all other selected items
  const copyToAll = () => {
    const firstSelected = assignments.find(a => a.selected);
    if (!firstSelected) {
      setMsg({ type: "error", text: "Please select at least one item with values to copy" });
      return;
    }
    if (!firstSelected.order_no || !firstSelected.delivery_date) {
      setMsg({ type: "error", text: "Please fill Order No and Delivery Date in the first selected item" });
      return;
    }
    
    const newAssignments = assignments.map(a => 
      a.selected ? { ...a, order_no: firstSelected.order_no, delivery_date: firstSelected.delivery_date } : a
    );
    setAssignments(newAssignments);
    setMsg({ type: "success", text: `Copied to ${newAssignments.filter(a => a.selected).length} items` });
    setTimeout(() => setMsg(null), 2000);
    
    if (mode === "create" && onChange) {
      onChange(newAssignments.map(({ _original, ...rest }) => ({
        ...rest,
        _original_item_id: rest._original_item_id
      })));
    }
  };

  const update = (i, f, v) => {
    const newAssignments = assignments.map((a, j) => j === i ? { ...a, [f]: v } : a);
    setAssignments(newAssignments);
    // Notify parent of changes (for create mode)
    // Include _original_item_id so parent can map back to original items
    if (mode === "create" && onChange) {
      onChange(newAssignments.map(({ _original, ...rest }) => ({
        ...rest,
        _original_item_id: rest._original_item_id
      })));
    }
  };

  const handleSplitClick = (item) => {
    setSplitItem({
      item_id: item.item_id,
      barcode: item.barcode,
      qty: item.qty,
      originalQty: item.qty
    });
  };

  const handleSplitConfirm = async (splits) => {
    const idx = assignments.findIndex(a => a.item_id === splitItem.item_id);
    if (idx === -1) return;
    
    const original = assignments[idx];
    
    // In edit mode, call API to actually split the item in database
    if (mode === "edit" && onSplit) {
      setSaving(true);
      try {
        // Call the split API - returns new item IDs
        const result = await onSplit({
          item_id: original._original_item_id || original.item_id,
          splits: splits.map(s => ({
            article_type: s.article_type || original.article_type,
            qty: parseFloat(s.qty) || 0
          }))
        });
        
        // The API should return the new split item IDs
        const newItemIds = result?.item_ids || result?.new_item_ids || [];
        
        // Create split assignments with the new database IDs
        const splitAssignments = splits.map((sp, i) => ({
          item_id: newItemIds[i] || `${original.item_id}_split_${i}_${Date.now()}`,
          barcode: original.barcode,
          qty: parseFloat(sp.qty) || 0,
          article_type: sp.article_type || original.article_type,
          embroidery_status: original.embroidery_status,
          order_no: "",
          delivery_date: "",
          selected: true,
          _original_item_id: newItemIds[i] || original._original_item_id || original.item_id
        }));
        
        const newAssignments = [...assignments];
        newAssignments.splice(idx, 1, ...splitAssignments);
        setAssignments(newAssignments);
        setSplitItem(null);
      } catch (err) {
        setMsg({ type: "error", text: err?.message || "Failed to split item" });
      } finally {
        setSaving(false);
      }
      return;
    }
    
    // Create mode: client-side split only
    const originalDbItemId = original._original_item_id || original.item_id;
    
    const splitAssignments = splits.map((sp, i) => ({
      item_id: `${original.item_id}_split_${i}_${Date.now()}`,
      barcode: original.barcode,
      qty: parseFloat(sp.qty) || 0,
      article_type: sp.article_type || original.article_type,
      embroidery_status: original.embroidery_status,
      order_no: "",
      delivery_date: "",
      selected: true,
      _original_item_id: originalDbItemId
    }));
    
    // Replace original with split parts
    const newAssignments = [...assignments];
    newAssignments.splice(idx, 1, ...splitAssignments);
    setAssignments(newAssignments);
    setSplitItem(null);
    
    // Notify parent
    // Include _original_item_id so parent can map back to original items after split
    if (mode === "create" && onChange) {
      onChange(newAssignments.map(({ _original, ...rest }) => ({
        ...rest,
        _original_item_id: rest._original_item_id
      })));
    }
  };

  const handleSave = async () => {
    const sel = assignments.filter(a => a.selected);
    if (!sel.length) { setMsg({ type: "error", text: "Please select at least one item" }); return; }
    const missing = sel.filter(a => !a.order_no || !a.delivery_date);
    if (missing.length) { setMsg({ type: "error", text: "Order No & Delivery Date required for all selected items" }); return; }
    
    setSaving(true);
    try {
      // Build payload for save
      // Use original DB item ID for split items so backend can find them
      const payload = sel.map(a => ({
        item_id: a._original_item_id || a.item_id,
        barcode: a.barcode,
        qty: a.qty,
        article_type: a.article_type,
        embroidery_status: a.embroidery_status,
        order_no: a.order_no,
        delivery_date: a.delivery_date
      }));
      
      await onSave(payload);
      setMsg({ type: "success", text: "Tailoring configuration saved!" });
      setTimeout(() => onClose(), 500);
    } catch (err) {
      setMsg({ type: "error", text: err?.message || "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[150] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <Card 
        className="w-full sm:max-w-4xl max-h-[94vh] flex flex-col shadow-2xl border-border/50 animate-in zoom-in-95 duration-150 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <CardHeader className="px-6 py-5 border-b border-border/50 bg-info/[0.03] shrink-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/10 text-info">
                  <Scissors size={20} weight="duotone" aria-hidden="true" />
                </div>
                <CardTitle className="text-lg font-black uppercase tracking-[0.2em]">{title}</CardTitle>
              </div>
              {customerName && (
                <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground ml-11">
                  <span className="uppercase tracking-widest">{customerName}</span>
                </div>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 rounded-full hover:bg-muted/50" aria-label="Close tailoring configurator">
              <X size={20} aria-hidden="true"/>
            </Button>
          </div>
        </CardHeader>

        <div className="flex-1 overflow-y-auto p-6 bg-background">
          {msg && (
            <Badge 
              variant={msg.type === "success" ? "success" : "destructive"} 
              className="w-full py-3 justify-center mb-6 text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-top-2"
            >
              {msg.type === "success" ? <CheckCircle className="mr-2" size={14}/> : <Info className="mr-2" size={14}/>}
              {msg.text}
            </Badge>
          )}

          {assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
              <Package size={48} weight="duotone" className="mb-4" aria-hidden="true" />
              <p className="text-[11px] font-black uppercase tracking-[0.2em]">No Items Awaiting Configuration</p>
            </div>
          ) : (
            <TailoringTable assignments={assignments} articleTypes={articleTypes} update={update} onSplitClick={handleSplitClick} />
          )}
        </div>

        <CardContent className="px-6 py-4 border-t border-border/50 bg-muted/30 shrink-0 flex justify-between items-center gap-3">
          <Button
            variant="outline"
            onClick={copyToAll}
            disabled={assignments.filter(a => a.selected).length < 2}
            className="h-10 text-[10px] font-black uppercase tracking-widest px-4 gap-2"
            aria-label="Copy Order No and Delivery Date from first selected item to all other selected items"
          >
            <Plus size={14} weight="bold" aria-hidden="true" /> Copy to All Selected
          </Button>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose} className="h-10 text-[10px] font-black uppercase tracking-widest px-6">
              Cancel
            </Button>
          <Button
            onClick={handleSave}
            disabled={saving || assignments.length === 0}
            className="h-10 px-10 gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20"
          >
            {saving ? (
              <>Processing <span className="animate-spin">⟳</span></>
            ) : (
              <><Check size={16} weight="bold" aria-hidden="true"/> {saveButtonText}</>
            )}
          </Button>
          </div>
        </CardContent>
      </Card>

      {/* Split sub-modal */}
      {splitItem && (
        <div 
          className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"
          onClick={() => setSplitItem(null)}
        >
          <Card 
            className="max-w-md w-full shadow-2xl border-border/50 animate-in zoom-in-95 duration-150 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <CardHeader className="px-6 py-5 border-b border-border/50 bg-primary/[0.03]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <ArrowsSplit size={18} weight="duotone" />
                </div>
                <CardTitle className="text-base font-black uppercase tracking-[0.2em]">Split Fabric</CardTitle>
              </div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1.5 ml-11">
                Total available: <span className="font-mono text-foreground">{splitItem.qty}m</span> · <span className="font-mono">{splitItem.barcode}</span>
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <SplitForm 
                item={splitItem} 
                articleTypes={articleTypes} 
                onConfirm={handleSplitConfirm} 
                onCancel={() => setSplitItem(null)}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default TailoringConfigurator;
