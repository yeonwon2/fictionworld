import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Loader2, Save, Trash2 } from "lucide-react";
import FileUrlInput from "@/components/FileUrlInput";
import ConfirmDialog from "@/components/ConfirmDialog";
import { createLocation, updateLocation, deleteLocation } from "@/lib/worldcrud";
import { useStory } from "@/lib/StoryContext";

const VALID_TYPES = ["Quốc gia", "Vùng đất", "Môn phái", "Thành trì", "Khác"];

// Form modal Thêm/Sửa địa danh. `location` = null → tạo mới.
export default function LocationFormModal({ open, location, locations = [], onClose, onSaved, onDeleted }) {
  const isEdit = !!location;
  const { currentStoryId } = useStory();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    if (location) {
      setForm({
        name: location.name || "",
        type: location.type || "Khác",
        map_url: location.map_url || "",
        description: location.description || "",
        parent_location_id: location.parent_location_id || "",
      });
    } else {
      setForm({ name: "", type: "Vùng đất", map_url: "", description: "", parent_location_id: "" });
    }
  }, [open, location]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  // Các địa danh có thể làm "cha" — loại trừ chính nó và các con cháu để tránh vòng lặp
  const availableParents = locations.filter((l) => {
    if (!isEdit) return true;
    if (l.id === location.id) return false;
    const descendants = new Set([location.id]);
    let changed = true;
    while (changed) {
      changed = false;
      locations.forEach((x) => {
        if (x.parent_location_id && descendants.has(x.parent_location_id) && !descendants.has(x.id)) {
          descendants.add(x.id);
          changed = true;
        }
      });
    }
    return !descendants.has(l.id);
  });

  async function handleSave() {
    if (!form.name?.trim()) {
      setError("Vui lòng nhập tên địa danh.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { ...form };
      if (!isEdit) payload.story_id = currentStoryId;
      const result = isEdit
        ? await updateLocation(location.id, payload)
        : await createLocation(payload);
      onSaved?.(result, isEdit ? "update" : "create");
      onClose?.();
    } catch (e) {
      setError(e?.message || "Lỗi khi lưu địa danh.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setConfirmOpen(false);
    try {
      await deleteLocation(location.id);
      onDeleted?.(location.id);
      onClose?.();
    } catch (e) {
      setError(e?.message || "Lỗi khi xóa địa danh.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            {isEdit ? "Chỉnh sửa địa danh" : "Thêm địa danh mới"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tên + Loại */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tên địa danh *</Label>
              <Input value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="VD: Huyền Thiên Tông" />
            </div>
            <div className="space-y-1.5">
              <Label>Loại</Label>
              <Select value={form.type} onValueChange={set("type")}>
                <SelectTrigger><SelectValue placeholder="Chọn loại" /></SelectTrigger>
                <SelectContent>
                  {VALID_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Địa danh cấp cha */}
          <div className="space-y-1.5">
            <Label>Địa danh cấp trên (Parent)</Label>
            <select
              value={form.parent_location_id || ""}
              onChange={(e) => set("parent_location_id")(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Cấp cao nhất (gốc) —</option>
              {availableParents.map((l) => (
                <option key={l.id} value={l.id}>{l.name} ({l.type})</option>
              ))}
            </select>
          </div>

          {/* Ảnh bản đồ */}
          <div className="space-y-1.5">
            <Label>Ảnh bản đồ</Label>
            <FileUrlInput value={form.map_url} onChange={set("map_url")} preview />
          </div>

          {/* Mô tả */}
          <div className="space-y-1.5">
            <Label>Mô tả</Label>
            <Textarea value={form.description} onChange={(e) => set("description")(e.target.value)} rows={3} placeholder="Mô tả địa danh..." />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          {isEdit && (
            <Button variant="destructive" onClick={() => setConfirmOpen(true)} type="button" className="mr-auto">
              <Trash2 className="w-4 h-4" /> Xóa
            </Button>
          )}
          <Button variant="outline" onClick={() => onClose?.()} type="button" disabled={saving}>Hủy</Button>
          <Button onClick={handleSave} disabled={saving} type="button">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? "Lưu thay đổi" : "Thêm địa danh"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Xóa địa danh này?"
        description="Địa danh sẽ bị xóa. Các địa danh con có thể mất cấp cha. Hành động không thể hoàn tác."
        onConfirm={handleDelete}
      />
    </Dialog>
  );
}