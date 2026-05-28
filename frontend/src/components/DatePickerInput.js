import { useState, forwardRef, memo } from "react";
import PropTypes from "prop-types";
import { format, parseISO, isValid } from "date-fns";
import { CalendarBlank } from "@phosphor-icons/react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

/**
 * A styled date picker input that wraps the shadcn Calendar inside a Popover.
 * Falls back to native date input on Safari/iOS for better mobile support (Fix 6.7).
 * value: ISO date string "YYYY-MM-DD" or ""
 * onChange: (isoString) => void
 * placeholder: string
 * disabled: boolean
 * className: extra classes for the trigger button
 */
const DatePickerInput = forwardRef(function DatePickerInput(
  { value, onChange, placeholder = "Pick a date", disabled = false, className = "", "data-testid": testId, onKeyDown, "aria-label": ariaLabel },
  ref
) {
  const [open, setOpen] = useState(false);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const parsed = value ? parseISO(value) : undefined;
  const selected = parsed && isValid(parsed) ? parsed : undefined;
  const display = selected ? format(selected, "dd MMM yyyy") : null;

  const handleSelect = (day) => {
    if (day) {
      onChange(format(day, "yyyy-MM-dd"));
    } else {
      onChange("");
    }
    setOpen(false);
  };

  // Safari/iOS fallback: use native date input
  if (isIOS) {
    return (
      <div className="relative">
        <input
          ref={ref}
          type="date"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          onKeyDown={onKeyDown}
          data-testid={testId}
          className={`h-10 px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--brand)] bg-[var(--surface)] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
          aria-label={ariaLabel || placeholder}
        />
      </div>
    );
  }

  return (
    <Popover open={open && !disabled} onOpenChange={(v) => !disabled && setOpen(v)}>
      <PopoverTrigger asChild>
        <button
          ref={ref}
          type="button"
          data-testid={testId}
          disabled={disabled}
          onKeyDown={onKeyDown}
          className={`flex items-center gap-2 h-10 px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--brand)] bg-[var(--surface)] text-left disabled:opacity-50 disabled:cursor-not-allowed ${!display ? "text-[var(--text-secondary)]" : "text-[var(--text-primary)]"} ${className}`}
          aria-label={ariaLabel || (display ? `Selected date: ${display}` : placeholder)}
        >
          <CalendarBlank size={14} className="flex-shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
          <span className="flex-1 truncate">{display || placeholder}</span>
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onChange(""); } }}
              className="ml-1 text-[var(--text-secondary)] hover:text-[var(--error)] leading-none"
              aria-label="Clear date"
            >
              ✕
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
});

DatePickerInput.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  'data-testid': PropTypes.string,
  onKeyDown: PropTypes.func,
};

DatePickerInput.displayName = 'DatePickerInput';

export { DatePickerInput };
export default memo(DatePickerInput);
