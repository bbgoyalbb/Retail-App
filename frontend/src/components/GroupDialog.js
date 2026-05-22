import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Plus, Trash, PencilSimple } from "@phosphor-icons/react";
import { createGroup, updateGroup, deleteGroup, getGroup } from "@/api";

export default function GroupDialog({ open, onClose, mode = "create", groupId = null, initialItems = [], allItems = [] }) {
  const [groupName, setGroupName] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (mode === "edit" && groupId) {
        loadGroupDetails();
      } else {
        setGroupName("");
        setSelectedItemIds(initialItems.map(i => i.barcode));
      }
    }
  }, [open, mode, groupId, initialItems]);

  const loadGroupDetails = async () => {
    try {
      setLoading(true);
      const groupData = await getGroup(groupId);
      setGroupName(groupData.group_name || "");
      setSelectedItemIds(groupData.items.map(i => i.barcode));
    } catch (error) {
      console.error("Failed to load group:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get item object by barcode
  const getItemByBarcode = (barcode) => {
    return allItems.find(i => i.barcode === barcode);
  };

  const handleSave = async () => {
    if (!groupName.trim()) {
      alert("Group name is required");
      return;
    }
    if (selectedItemIds.length === 0) {
      alert("Please select at least one item");
      return;
    }

    try {
      setLoading(true);
      if (mode === "create") {
        await createGroup(selectedItemIds, groupName);
      } else if (mode === "edit") {
        await updateGroup(groupId, selectedItemIds, groupName);
      }
      onClose();
    } catch (error) {
      alert(error.response?.data?.detail || "Failed to save group");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this group?")) return;
    try {
      setLoading(true);
      await deleteGroup(groupId);
      onClose();
    } catch (error) {
      alert(error.response?.data?.detail || "Failed to delete group");
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (barcode) => {
    setSelectedItemIds(prev =>
      prev.includes(barcode)
        ? prev.filter(id => id !== barcode)
        : [...prev, barcode]
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <Card className="max-w-2xl w-full shadow-2xl border-border/50 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-black uppercase tracking-[0.2em]">
            {mode === "create" ? "Create Group" : "Edit Group"}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X size={20} weight="bold" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 flex-1 overflow-y-auto">
          <div>
            <label className="text-sm font-semibold mb-2 block">Group Name *</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g., Complete Dress Set 1"
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-sm font-semibold mb-2 block">Select Articles</label>
            <div className="border border-border rounded-md max-h-64 overflow-y-auto">
              {allItems.map((item) => (
                <div
                  key={item.barcode}
                  className="flex items-center justify-between p-3 border-b border-border last:border-b-0 hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggleItem(item.barcode)}
                >
                  <div className="flex-1">
                    <div className="font-medium">{item.barcode}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.article_type || "—"} • <span className="font-mono">{item.ref}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-mono">
                      ₹{((item.fabric_amount || 0) + (item.tailoring_amount || 0) + (item.embroidery_amount || 0) + (item.addon_amount || 0)).toFixed(0)}
                    </div>
                    {selectedItemIds.includes(item.barcode) ? (
                      <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <Plus size={12} weight="bold" className="text-primary-foreground" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 border-2 border-border rounded-full" />
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {selectedItemIds.length} item(s) selected
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="flex gap-2">
              {mode === "edit" && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  <Trash size={16} className="mr-1" />
                  Delete Group
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? "Saving..." : mode === "create" ? "Create Group" : "Save Changes"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
