import { PencilSimple, Trash, Printer, CaretDown, X, Check, Scissors, Tag, CircleNotch as Spinner } from "@phosphor-icons/react";
import { fmt } from "@/lib/fmt";

const StatusBadge = ({ settled, cancelled, pending }) => {
  if (cancelled) return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-[var(--error)]/10 text-[var(--error)] font-medium">Cancelled</span>
  );
  if (settled) return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-[#455D4A15] text-[var(--success)] font-medium flex items-center gap-0.5">
      <Check size={10} weight="fill" />Settled
    </span>
  );
  return <span className="text-[10px] font-mono text-[var(--warning)]">₹{fmt(pending)}</span>;
};

/**
 * ItemsDataTable - The main items table with selection and actions
 * 
 * @param {Object} props
 * @param {Array} props.items - Items to display
 * @param {boolean} props.loading - Loading state
 * @param {Set} props.selectedRefs - Selected reference IDs
 * @param {Function} props.setSelectedRefs - Selection setter
 * @param {Function} props.onEdit - (item, mode) => void - Edit callback
 * @param {Function} props.onDelete - (item) => void - Delete callback
 * @param {Function} props.onPrint - (ref) => void - Print callback
 * @param {Function} props.onOpenDetail - (item) => void - Open detail panel
 * @param {Function} props.onToggleSidebar - () => void - Toggle sidebar (mobile)
 * @param {boolean} props.sidebarOpen - Sidebar open state
 * @param {Object} props.sortConfig - { key, dir } sort configuration
 * @param {Function} props.onSort - (key) => void - Sort callback
 */
export default function ItemsDataTable({
  items,
  loading,
  selectedRefs,
  setSelectedRefs,
  onEdit,
  onDelete,
  onPrint,
  onOpenDetail,
  onToggleSidebar,
  sidebarOpen,
}) {
  const toggleSelectRef = (ref) => {
    const next = new Set(selectedRefs);
    if (next.has(ref)) next.delete(ref);
    else next.add(ref);
    setSelectedRefs(next);
  };

  const allSelected = items.length > 0 && items.every(i => selectedRefs.has(i.ref));
  const someSelected = items.some(i => selectedRefs.has(i.ref)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedRefs(new Set());
    } else {
      setSelectedRefs(new Set(items.map(i => i.ref)));
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-[var(--surface)] custom-scrollbar">
      <table className="w-full text-xs">
        <thead className="bg-[var(--bg)] sticky top-0 z-10">
          <tr className="border-b border-[var(--border-subtle)]">
            <th className="w-10 px-2 py-2 border-r border-[var(--border-subtle)]">
              <input
                type="checkbox"
                checked={allSelected}
                ref={el => el && (el.indeterminate = someSelected)}
                onChange={toggleAll}
                className="w-4 h-4 accent-[var(--brand)]"
              />
            </th>
            <th className="px-3 py-2 text-left font-semibold text-[var(--text-secondary)] border-r border-[var(--border-subtle)]">Date / Ref</th>
            <th className="px-3 py-2 text-left font-semibold text-[var(--text-secondary)] border-r border-[var(--border-subtle)]">Customer / Barcode</th>
            <th className="px-3 py-2 text-right font-semibold text-[var(--text-secondary)] border-r border-[var(--border-subtle)]">Amount</th>
            <th className="px-3 py-2 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-subtle)]">Fabric</th>
            <th className="px-3 py-2 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-subtle)]">Tailoring</th>
            <th className="px-3 py-2 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-subtle)]">Embroidery</th>
            <th className="px-3 py-2 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-subtle)]">Add-on</th>
            <th className="px-3 py-2 text-center font-semibold text-[var(--text-secondary)]">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {loading ? (
            <tr>
              <td colSpan="9" className="px-4 py-8 text-center text-[var(--text-secondary)]">
                <span className="inline-flex items-center gap-2">
                  <Spinner size={16} className="animate-spin" /> Loading...
                </span>
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan="9" className="px-4 py-8 text-center text-[var(--text-secondary)]">
                No items found matching your filters.
              </td>
            </tr>
          ) : (
            items.map((item) => {
              const selected = selectedRefs.has(item.ref);
              return (
                <tr
                  key={item._id}
                  className={`group hover:bg-[#C86B4D04] transition-colors min-h-[50px] sm:min-h-0 ${selected ? "bg-[#C86B4D08]" : ""}`}
                >
                  <td className="px-2 py-3 sm:py-2 border-r border-[var(--border-subtle)]">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSelectRef(item.ref)}
                      className="w-4 h-4 accent-[var(--brand)]"
                    />
                  </td>
                  <td className="px-3 py-2 border-r border-[var(--border-subtle)]">
                    <div className="flex flex-col">
                      <span className="font-mono text-[var(--text-primary)]">{item.ref}</span>
                      <span className="text-[10px] text-[var(--text-secondary)]">{item.date}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 border-r border-[var(--border-subtle)]">
                    <div className="flex flex-col">
                      <span className="font-medium text-[var(--text-primary)]">{item.name}</span>
                      <span className="text-[10px] text-[var(--text-secondary)] font-mono">{item.barcode}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right border-r border-[var(--border-subtle)] font-mono font-medium">
                    ₹{fmt(item.fabric_amount)}
                  </td>
                  <td className="px-2 py-2 text-center border-r border-[var(--border-subtle)]">
                    <StatusBadge
                      settled={item.fabric_received >= item.fabric_amount}
                      cancelled={item.cancelled}
                      pending={item.fabric_pending}
                    />
                  </td>
                  <td className="px-2 py-2 text-center border-r border-[var(--border-subtle)]">
                    <div className="flex flex-col items-center gap-0.5">
                      <StatusBadge
                        settled={item.tailoring_received >= item.tailoring_amount}
                        cancelled={item.cancelled}
                        pending={item.tailoring_pending}
                      />
                      {item.tailoring_status && item.tailoring_status !== "N/A" && (
                        <span className="text-[9px] text-[var(--text-secondary)]">{item.tailoring_status}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center border-r border-[var(--border-subtle)]">
                    <StatusBadge
                      settled={item.embroidery_received >= item.embroidery_amount}
                      cancelled={item.cancelled}
                      pending={item.embroidery_pending}
                    />
                  </td>
                  <td className="px-2 py-2 text-center border-r border-[var(--border-subtle)]">
                    <StatusBadge
                      settled={item.addon_received >= item.addon_amount}
                      cancelled={item.cancelled}
                      pending={item.addon_pending}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onEdit(item, "order")}
                        className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--brand)] rounded-sm"
                        title="Edit"
                      >
                        <PencilSimple size={14} />
                      </button>
                      <button
                        onClick={() => onPrint(item.ref)}
                        className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--info)] rounded-sm"
                        title="Print"
                      >
                        <Printer size={14} />
                      </button>
                      <button
                        onClick={() => onDelete(item)}
                        className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--error)] rounded-sm"
                        title="Delete"
                      >
                        <Trash size={14} />
                      </button>
                      <button
                        onClick={() => onOpenDetail(item)}
                        className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-sm sm:hidden"
                        title="Details"
                      >
                        <CaretDown size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
