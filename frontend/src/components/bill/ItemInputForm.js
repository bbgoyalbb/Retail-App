import { Plus, Barcode } from "@phosphor-icons/react";

/**
 * ItemInputForm - Form for adding/editing bill line items
 * 
 * @param {Object} props
 * @param {string} props.barcode - Barcode input value
 * @param {string} props.qty - Quantity input value
 * @param {string} props.price - Price input value
 * @param {string} props.discount - Discount input value
 * @param {number|null} props.editingIndex - Index being edited, or null for new items
 * @param {Object} props.refs - Refs for focus management {barcodeRef, qtyRef, priceRef, discountRef}
 * @param {Function} props.onChange - Callback(fieldName, value) for input changes
 * @param {Function} props.onAdd - Callback to add/update item
 * @param {Function} props.onOpenScanner - Callback to open barcode scanner
 * @param {Function} props.onKeyNav - Callback(e, nextRefName) for Enter key navigation
 */
export default function ItemInputForm({
  barcode,
  qty,
  price,
  discount,
  editingIndex,
  refs,
  onChange,
  onAdd,
  onOpenScanner,
  onKeyNav
}) {
  const isEditing = editingIndex !== null;

  const handleKeyDown = (e, field) => {
    if (e.key !== 'Enter') return;
    
    e.preventDefault();
    const fieldMap = {
      barcode: refs.qtyRef,
      qty: refs.priceRef,
      price: refs.discountRef,
      discount: null // Last field - trigger add
    };
    
    if (field === 'discount') {
      onAdd();
    } else {
      fieldMap[field]?.current?.focus();
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-6 gap-3">
      {/* Barcode with scanner button */}
      <div className="relative col-span-2 sm:col-span-2">
        <input
          ref={refs.barcodeRef}
          data-testid="barcode-input"
          value={barcode}
          onChange={(e) => onChange('barcode', e.target.value)}
          placeholder="Barcode / Item No."
          maxLength={60}
          className="w-full px-3 py-2 pr-10 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
          onKeyDown={(e) => handleKeyDown(e, 'barcode')}
        />
        <button
          data-testid="scan-barcode-btn"
          onClick={onOpenScanner}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-[var(--brand)] hover:bg-[#C86B4D10] rounded-sm"
          title="Scan with camera"
          type="button"
        >
          <Barcode size={18} weight="duotone" />
        </button>
      </div>

      {/* Quantity */}
      <input
        ref={refs.qtyRef}
        data-testid="qty-input"
        value={qty}
        onChange={(e) => onChange('qty', e.target.value)}
        placeholder="Qty (m)"
        type="number"
        step="0.1"
        min="0"
        inputMode="decimal"
        pattern="[0-9]*"
        className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
        onKeyDown={(e) => handleKeyDown(e, 'qty')}
      />

      {/* Price */}
      <input
        ref={refs.priceRef}
        data-testid="price-input"
        value={price}
        onChange={(e) => onChange('price', e.target.value)}
        placeholder="Price/m"
        type="number"
        min="0"
        inputMode="decimal"
        pattern="[0-9]*"
        className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
        onKeyDown={(e) => handleKeyDown(e, 'price')}
      />

      {/* Discount */}
      <input
        ref={refs.discountRef}
        data-testid="discount-input"
        value={discount}
        onChange={(e) => onChange('discount', e.target.value)}
        placeholder="Disc%"
        type="number"
        min="0"
        max="100"
        inputMode="decimal"
        pattern="[0-9]*"
        className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
        onKeyDown={(e) => handleKeyDown(e, 'discount')}
      />

      {/* Add/Update Button */}
      <button
        data-testid="add-item-btn"
        onClick={onAdd}
        disabled={!barcode || !qty || !price}
        className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] transition-all duration-200 hover:translate-y-[-1px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        type="button"
      >
        <Plus size={16} weight="bold" />
        {isEditing ? 'Update' : 'Add'}
      </button>
    </div>
  );
}
