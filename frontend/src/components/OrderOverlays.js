import { addAddons, assignTailoring } from "@/api";
import { TailoringConfigurator } from "./TailoringConfigurator";
import { AddOnConfigurator } from "./AddOnConfigurator";

// ─── Tailoring Overlay ────────────────────────────────────────
// Thin wrapper around shared TailoringConfigurator for "edit" mode (Item Manager)
export function TailoringOverlay({ group, onClose, onSuccess }) {
  // Normalize group.items to the format expected by TailoringConfigurator
  const items = group.items.filter(i =>
    !i.order_no || i.order_no === "N/A" || i.tailoring_status === "Awaiting Order"
  );

  const handleSave = async (assignments) => {
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
  };

  return (
    <TailoringConfigurator
      items={items}
      onSave={handleSave}
      onClose={onClose}
      mode="edit"
      title="Tailoring Assignment"
      saveButtonText="Confirm Assignment"
    />
  );
}

// ─── Add-on Overlay ───────────────────────────────────────────
// Thin wrapper around shared AddOnConfigurator for "edit" mode (Item Manager)
export function AddOnOverlay({ group, onClose, onSuccess }) {
  const items = group.items || [];

  const handleSave = async (payload) => {
    // In edit mode, we save each item's addons individually via API
    for (const itemPayload of payload) {
      if (itemPayload.addons.length > 0) {
        await addAddons({
          item_id: itemPayload.item_id,
          addons: itemPayload.addons
        });
      }
    }
    onSuccess();
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
