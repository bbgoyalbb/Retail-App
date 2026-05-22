import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, FileText, ListDashes } from "@phosphor-icons/react";

export default function InvoiceFormatDialog({ open, onClose, onSelect }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Invoice Format</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-4">
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
              <div className="font-semibold">Article-wise Format</div>
              <div className="text-xs text-muted-foreground">
                Per-article breakdown with totals
              </div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
