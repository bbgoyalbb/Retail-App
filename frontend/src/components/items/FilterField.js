import React from "react";

export default function FilterField({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/80 block px-0.5">
        {label}
      </label>
      {children}
    </div>
  );
}
