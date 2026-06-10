import { addAddons, assignTailoring, splitTailoring } from "@/api";
import { TailoringConfigurator } from "./TailoringConfigurator";
import { AddOnConfigurator } from "./AddOnConfigurator";
import { useToast } from "@/hooks/use-toast";

// ─── Tailoring Overlay ────────────────────────────────────────
// Thin wrapper around shared TailoringConfigurator for "edit" mode (Item Manager)
export function TailoringOverlay({ group, onClose, onSuccess }) {
  const { toast } = useToast();

  // Normalize group.items to the format expected by TailoringConfigurator
  const items = group.items.filter(i =>
    !i.order_no || i.order_no === "N/A" || i.tailoring_status === "Awaiting Order"
  );

  const handleSplit = async ({ item_id, splits }) => {
    try {
      // Call API to actually split the item in database
      const result = await splitTailoring({
        item_id,
        splits: splits.map(s => ({
          article_type: s.article_type,
          qty: s.qty
        }))
      });
      return result.data || result;
    } catch (error) {
      console.error("Failed to split tailoring:", error);
      toast({
        variant: "destructive",
        title: "Failed to split item",
        description: error.response?.data?.detail || error.message || "An unexpected error occurred",
      });
      throw error;
    }
  };

  const handleSave = async (assignments) => {
    try {
      // Group by order_no + delivery_date
      const groups = {};
      assignments.forEach(a => {
        const k = `${a.order_no}|${a.delivery_date}`;
        if (!groups[k]) groups[k] = { order_no: a.order_no, delivery_date: a.delivery_date, items: [] };
        groups[k].items.push({ item_id: a.item_id, article_type: a.article_type, embroidery_status: a.embroidery_status });
      });

      // Call API for each group
      for (const g of Object.values(groups)) {
        await assignTailoring({
          item_ids: g.items.map(i => i.item_id),
          order_no: g.order_no,
          delivery_date: g.delivery_date,
          assignments: g.items,
        });
      }
      onSuccess();
    } catch (error) {
      console.error("Failed to save tailoring assignments:", error);
      toast({
        variant: "destructive",
        title: "Failed to save assignments",
        description: error.response?.data?.detail || error.message || "An unexpected error occurred",
      });
    }
  };

  return (
    <TailoringConfigurator
      items={items}
      onSave={handleSave}
      onClose={onClose}
      onSplit={handleSplit}
      mode="edit"
      title="Tailoring Assignment"
      saveButtonText="Confirm Assignment"
    />
  );
}

// ─── Add-on Overlay ───────────────────────────────────────────
// Thin wrapper around shared AddOnConfigurator for "edit" mode (Item Manager)
export function AddOnOverlay({ group, onClose, onSuccess }) {
  const { toast } = useToast();
  const items = group.items || [];

  const handleSave = async (payload) => {
    try {
      // In edit mode, we save each item's addons individually via API.
      // Always send each item payload so deletions are applied too.
      for (const itemPayload of payload) {
        await addAddons({
          item_id: itemPayload.item_id,
          addons: itemPayload.addons
        });
      }
      onSuccess();
    } catch (error) {
      console.error("Failed to save add-ons:", error);
      toast({
        variant: "destructive",
        title: "Failed to save add-ons",
        description: error.response?.data?.detail || error.message || "An unexpected error occurred",
      });
    }
  };

  return (
    <AddOnConfigurator
      items={items}
      onSave={handleSave}
      onClose={onClose}
      mode="edit"
      title="Order Add-ons"
      saveButtonText="Update Add-ons"
    />
  );
}
