import { useEffect, useState } from "react";
import { X, Keyboard } from "@phosphor-icons/react";

const SHORTCUTS = [
  { section: "Navigation", items: [
    { keys: ["Ctrl", "1"], desc: "Dashboard" },
    { keys: ["Ctrl", "2"], desc: "New Bill" },
    { keys: ["Ctrl", "3"], desc: "Manage Orders" },
    { keys: ["Ctrl", "4"], desc: "Daybook" },
    { keys: ["Ctrl", "5"], desc: "Reports" },
  ]},
  { section: "New Bill", items: [
    { keys: ["Ctrl", "S"], desc: "Save bill" },
    { keys: ["Enter"], desc: "Advance to next field" },
    { keys: ["Esc"], desc: "Close addon/tailoring modal" },
  ]},
  { section: "General", items: [
    { keys: ["?"], desc: "Open this help panel" },
    { keys: ["Esc"], desc: "Close any modal" },
  ]},
];

export default function ShortcutHelpModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
        setOpen(prev => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const handleEvent = () => setOpen(true);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("shortcuts:open", handleEvent);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("shortcuts:open", handleEvent);
    };
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[var(--border-subtle)]">
          <Keyboard size={18} className="text-[var(--brand)]" />
          <h2 className="font-heading text-base font-medium flex-1">Keyboard Shortcuts</h2>
          <kbd className="px-1.5 py-0.5 text-[10px] border border-[var(--border-subtle)] rounded bg-[var(--bg)] font-mono text-[var(--text-secondary)]">?</kbd>
          <button
            onClick={() => setOpen(false)}
            className="ml-2 p-1 rounded-sm hover:bg-[var(--bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Close shortcuts panel"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {SHORTCUTS.map(({ section, items }) => (
            <div key={section}>
              <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[var(--text-secondary)] mb-2">{section}</p>
              <div className="space-y-2">
                {items.map(({ keys, desc }) => (
                  <div key={desc} className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-primary)]">{desc}</span>
                    <div className="flex items-center gap-1">
                      {keys.map((k, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <kbd className="px-2 py-0.5 text-xs border border-[var(--border-subtle)] rounded bg-[var(--bg)] font-mono text-[var(--text-primary)] shadow-sm">
                            {k}
                          </kbd>
                          {i < keys.length - 1 && <span className="text-[10px] text-[var(--text-secondary)]">+</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg)] rounded-b-sm">
          <p className="text-[10px] text-[var(--text-secondary)]">Press <kbd className="px-1 py-0.5 text-[10px] border border-[var(--border-subtle)] rounded font-mono">?</kbd> anywhere to toggle this panel · <kbd className="px-1 py-0.5 text-[10px] border border-[var(--border-subtle)] rounded font-mono">Esc</kbd> to close</p>
        </div>
      </div>
    </div>
  );
}
