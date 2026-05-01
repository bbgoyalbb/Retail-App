import { PencilSimple, Trash, Scissors, Plus } from "@phosphor-icons/react";

/**
 * BillLineItemRow - Displays a single item in the bill with actions
 * 
 * @param {Object} props
 * @param {Object} props.item - The item data {barcode, qty, price, discount, total, tailoring, addon}
 * @param {number} props.index - Index in the items array
 * @param {boolean} props.isEditing - Whether this row is being edited
 * @param {Function} props.onEdit - Callback to edit this item
 * @param {Function} props.onRemove - Callback to remove this item
 * @param {Function} props.onOpenTailoring - Callback to open tailoring config
 * @param {Function} props.onOpenAddon - Callback to open addon config
 */
export default function BillLineItemRow({ 
  item, 
  index, 
  isEditing, 
  onEdit, 
  onRemove, 
  onOpenTailoring, 
  onOpenAddon 
}) {
  const tailoringActive = item.tailoring?.enabled;
  const addonActive = item.addon?.enabled && item.addon?.items?.length > 0;
  const addonTotal = (item.addon?.items || []).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);

  return (
    <div 
      data-testid={`bill-item-row-${index}`}
      className={`group flex items-center justify-between p-3 border rounded-sm transition-all ${
        isEditing 
          ? 'border-[var(--brand)] bg-[#C86B4D10] ring-1 ring-[var(--brand)]' 
          : 'border-[var(--border-subtle)] bg-[var(--surface)] hover:border-[var(--brand)]'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-medium">{item.barcode}</span>
          {isEditing && (
            <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--brand)]">Editing</span>
          )}
        </div>
        <div className="mt-1 text-xs text-[var(--text-secondary)] flex items-center gap-3 flex-wrap">
          <span>{item.qty}m × ₹{item.price}</span>
          {item.discount > 0 && <span className="text-[var(--warning)]">-{item.discount}%</span>}
          <span className="font-medium text-[var(--text-primary)]">= ₹{item.total.toLocaleString('en-IN')}</span>
          {addonTotal > 0 && (
            <span className="text-[var(--success)]">+₹{addonTotal} addon</span>
          )}
        </div>
        {(tailoringActive || addonActive) && (
          <div className="mt-1.5 flex items-center gap-2">
            {tailoringActive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-[#C86B4D20] text-[var(--brand)] rounded-sm">
                <Scissors size={10} /> Tailoring
              </span>
            )}
            {addonActive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-[#455D4A20] text-[var(--success)] rounded-sm">
                <Plus size={10} /> {item.addon.items.length} add-on{item.addon.items.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-1 ml-3">
        <button
          onClick={() => onOpenTailoring(index)}
          className={`p-2 rounded-sm transition-colors ${
            tailoringActive 
              ? 'text-[var(--brand)] bg-[#C86B4D15]' 
              : 'text-[var(--text-secondary)] hover:text-[var(--brand)] hover:bg-[#C86B4D10]'
          }`}
          title={tailoringActive ? "Edit tailoring" : "Add tailoring"}
        >
          <Scissors size={18} />
        </button>
        <button
          onClick={() => onOpenAddon(index)}
          className={`p-2 rounded-sm transition-colors ${
            addonActive 
              ? 'text-[var(--success)] bg-[#455D4A15]' 
              : 'text-[var(--text-secondary)] hover:text-[var(--success)] hover:bg-[#455D4A10]'
          }`}
          title={addonActive ? "Edit add-ons" : "Add add-ons"}
        >
          <Plus size={18} />
        </button>
        <button
          onClick={() => onEdit(index)}
          className={`p-2 rounded-sm transition-colors ${
            isEditing 
              ? 'text-[var(--brand)]' 
              : 'text-[var(--text-secondary)] hover:text-[var(--brand)] hover:bg-[#C86B4D10]'
          }`}
          title="Edit item"
        >
          <PencilSimple size={18} />
        </button>
        <button
          onClick={() => onRemove(index)}
          className="p-2 text-[var(--text-secondary)] hover:text-[var(--error)] hover:bg-[#9E473D10] rounded-sm transition-colors"
          title="Remove item"
        >
          <Trash size={18} />
        </button>
      </div>
    </div>
  );
}
