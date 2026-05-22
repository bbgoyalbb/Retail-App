import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer, FileText, ListDashes, X, Rows } from "@phosphor-icons/react";
import { useEffect } from "react";

export default function InvoiceFormatDialog({ open, onClose, onSelect }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    if (open) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <Card className="max-w-md w-full shadow-2xl border-border/50 animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-black uppercase tracking-[0.2em]">Select Invoice Format</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X size={20} weight="bold" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={() => onSelect("standard")}
            className="w-full h-auto py-4 flex-col gap-2"
            variant="outline"
          >
            <ListDashes size={32} />
            <div className="text-left">
              <div className="font-semibold">Section-wise Format</div>
              <div className="text-xs text-muted-foreground">
                Fabric, Tailoring, Embroidery, Add-on sections
              </div>
            </div>
          </Button>
          <Button
            onClick={() => onSelect("article-wise")}
            className="w-full h-auto py-4 flex-col gap-2"
            variant="outline"
          >
            <FileText size={32} />
            <div className="text-left">
              <div className="font-semibold">Article-wise (Detailed)</div>
              <div className="text-xs text-muted-foreground">
                Per-article breakdown with section totals
              </div>
            </div>
          </Button>
          <Button
            onClick={() => onSelect("article-summary")}
            className="w-full h-auto py-4 flex-col gap-2"
            variant="outline"
          >
            <Rows size={32} />
            <div className="text-left">
              <div className="font-semibold">Article-wise (Summary)</div>
              <div className="text-xs text-muted-foreground">
                Just barcode, article type, and total
              </div>
            </div>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
