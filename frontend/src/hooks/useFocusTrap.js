import { useEffect, useRef } from "react";

/**
 * useFocusTrap - Traps focus within a modal/dialog element
 * @param {boolean} active - Whether the focus trap is active
 * @returns {React.RefObject} - Ref to attach to the container element
 */
export function useFocusTrap(active) {
  const ref = useRef(null);

  useEffect(() => {
    if (!active || !ref.current) return;

    const el = ref.current;
    const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    // Focus first element when trap activates
    el.querySelectorAll(FOCUSABLE)[0]?.focus();

    const trap = (e) => {
      if (e.key !== "Tab") return;
      // Re-query on every keydown so dynamic content is always current
      const focusable = Array.from(el.querySelectorAll(FOCUSABLE)).filter(n => !n.disabled);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) return;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    el.addEventListener("keydown", trap);
    return () => el.removeEventListener("keydown", trap);
  }, [active]);

  return ref;
}
